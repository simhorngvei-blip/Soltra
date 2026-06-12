import cv2
import numpy as np
import time

def main():
    print("=============================================")
    print("   SOLTRA COMPUTER VISION - SUN TRACKER      ")
    print("=============================================")
    
    ip_addr = input("Enter S3 Camera IP (e.g. 192.168.1.50): ").strip()
    if not ip_addr:
        print("Invalid IP. Exiting.")
        return
        
    stream_url = f"http://{ip_addr}/stream"
    print(f"Connecting to {stream_url} ...")
    
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print("Error: Could not open video stream. Check IP and ensure S3 is on the same Wi-Fi.")
        return

    print("Connected! Press 'q' to quit.")

    # Variables to limit console spam
    last_print_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame. Stream might have dropped.")
            break
            
        height, width = frame.shape[:2]
        center_x, center_y = width // 2, height // 2

        # 1. Convert to Grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 2. Apply Gaussian Blur to smooth out noise
        blurred = cv2.GaussianBlur(gray, (21, 21), 0)
        
        # 3. Apply a strict Binary Threshold
        # Only pixels brighter than 240 (out of 255) will remain white. Everything else goes black.
        _, thresh = cv2.threshold(blurred, 240, 255, cv2.THRESH_BINARY)
        
        # 4. Find all "blobs" (contours) of light in the thresholded image
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        current_time = time.time()
        
        # Draw Center Target (Red)
        cv2.line(frame, (center_x, center_y - 20), (center_x, center_y + 20), (0, 0, 255), 2)
        cv2.line(frame, (center_x - 20, center_y), (center_x + 20, center_y), (0, 0, 255), 2)

        if contours:
            # Sort contours by Area (largest first). 
            # The sun will be the largest blindingly bright object. Small reflections will be ignored.
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            largest_contour = contours[0]
            area = cv2.contourArea(largest_contour)

            # Only track if the blob is large enough (ignores tiny reflections/noise)
            if area > 100:
                # Calculate the "Center of Mass" (Centroid) of the largest bright blob
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    sun_x = int(M["m10"] / M["m00"])
                    sun_y = int(M["m01"] / M["m00"])

                    # Draw tracking crosshair and bounding box (Cyan)
                    x, y, w, h = cv2.boundingRect(largest_contour)
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 255, 0), 2)
                    cv2.circle(frame, (sun_x, sun_y), 5, (255, 255, 0), -1)
                    
                    # Calculate offsets
                    pan_offset = sun_x - center_x
                    tilt_offset = center_y - sun_y  
                    
                    if current_time - last_print_time > 0.5:
                        print(f"[MOTOR CMD] Area: {area:>5}px | PAN: {pan_offset:>4} | TILT: {tilt_offset:>4}")
                        last_print_time = current_time
            else:
                if current_time - last_print_time > 1.0:
                    print("[SEARCHING] Brightest objects are too small. Waiting for sun.")
                    last_print_time = current_time
        else:
            if current_time - last_print_time > 1.0:
                print("[SEARCHING] No bright objects found in the sky.")
                last_print_time = current_time

        # Show the video feed window (and the thresholded mask for debugging!)
        cv2.imshow("Soltra CV Tracker", frame)
        cv2.imshow("Soltra Debug Mask", thresh)
        
        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
