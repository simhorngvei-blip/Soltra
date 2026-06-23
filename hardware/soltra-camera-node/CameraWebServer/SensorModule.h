#ifndef SENSOR_MODULE_H
#define SENSOR_MODULE_H

void initSensors();
void readSensors(int* ldr, float* uv, float* ir, uint32_t* lux, float* battery);

#endif