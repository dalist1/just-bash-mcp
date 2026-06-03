| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `bash -lc` | 45.5 ± 4.7 | 34.9 | 53.0 | 3.07 ± 0.52 |
| `bash < stdin` | 14.8 ± 2.0 | 11.7 | 20.1 | 1.00 |
| `bun stdin -> bash -lc` | 83.4 ± 18.6 | 63.2 | 175.1 | 5.63 ± 1.47 |
| `bun stdin -> bash < stdin` | 61.2 ± 39.0 | 36.9 | 205.2 | 4.13 ± 2.69 |
