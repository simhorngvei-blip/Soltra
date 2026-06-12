#include "esp_http_server.h"
#include "esp_timer.h"
#include "esp_camera.h"
#include "Arduino.h"

// Pulling the on/off functions from the main file
extern void turnCameraOn();
extern void turnCameraOff();

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;

// ── /capture handler ─────────────────────────────────────────────────────────
// Returns a single JPEG still frame as image/jpeg.
// Used by: soltra-hud-mobile LiveCameraModal (snapshot mode + REQUEST SNAPSHOT button).
static esp_err_t capture_handler(httpd_req_t *req) {
  turnCameraOn();
  vTaskDelay(pdMS_TO_TICKS(300)); // Brief stabilisation after wake-up

  // Flush the stale frame that was buffered while the camera was sleeping
  camera_fb_t *flush = esp_camera_fb_get();
  if (flush) { esp_camera_fb_return(flush); }

  // Now grab the fresh frame
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAPTURE] Frame grab failed");
    turnCameraOff();
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=snapshot.jpg");
  // Allow cross-origin requests (mobile HUD served from different origin / ngrok)
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);

  esp_camera_fb_return(fb);
  turnCameraOff();
  return res;
}

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  // 1. WAKE UP CAMERA
  turnCameraOn();
  vTaskDelay(pdMS_TO_TICKS(500)); // Give the sensor half a second to stabilize colors

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    turnCameraOff();
    return res;
  }

  // 2. STREAM LOOP
  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
      break;
    }
    
    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if (res == ESP_OK) {
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    
    esp_camera_fb_return(fb);
    
    if (res != ESP_OK) {
      break; // Client disconnected or network error
    }
  }

  // 3. SHUT DOWN CAMERA
  turnCameraOff();
  return res;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  // Increase max URI handlers if needed, though this is minimal
  config.max_uri_handlers = 8; // /stream + /capture + room for future routes

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }
}