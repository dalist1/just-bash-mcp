| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `bash -lc` | 35.6 ± 4.4 | 28.7 | 43.5 | 3.88 ± 0.98 |
| `bash < stdin` | 9.2 ± 2.0 | 6.4 | 14.1 | 1.00 |
| `bun stdin -> bash -lc` | 69.4 ± 5.9 | 59.3 | 82.0 | 7.58 ± 1.79 |
| `bun stdin -> bash < stdin` | 43.1 ± 6.4 | 34.2 | 55.2 | 4.70 ± 1.25 |
