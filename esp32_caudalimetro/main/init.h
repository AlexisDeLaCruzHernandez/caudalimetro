#ifndef INIT_H
#define INIT_H

#include <stdio.h>
#include <dirent.h>

#define BUFFER_SIZE         256
#define INTERVAL_MIN        15
#define INTERVAL_SEC        (INTERVAL_MIN * 60) 
#define INTERVAL_MAX_LITER  ((5000 / 60) * INTERVAL_MIN)

void borrar_todos_los_archivos(const char *path);

#endif /* INIT_H */
