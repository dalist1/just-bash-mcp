| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `bash -lc` | 44.0 ± 13.4 | 32.1 | 83.4 | 1.48 ± 1.30 |
| `bash < stdin` | 29.8 ± 24.5 | 9.2 | 97.2 | 1.00 |
| `bun stdin -> bash -lc` | 83.2 ± 30.1 | 54.2 | 150.7 | 2.79 ± 2.51 |
| `bun stdin -> bash < stdin` | 51.8 ± 17.4 | 35.5 | 104.3 | 1.74 ± 1.54 |
