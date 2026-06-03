| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `bash -lc` | 58.4 ± 9.5 | 43.9 | 80.7 | 1.90 ± 0.62 |
| `bash < stdin` | 30.7 ± 8.7 | 20.1 | 48.6 | 1.00 |
| `bun stdin -> bash -lc` | 90.2 ± 9.6 | 69.5 | 108.3 | 2.93 ± 0.89 |
| `bun stdin -> bash < stdin` | 60.0 ± 6.4 | 48.9 | 73.7 | 1.95 ± 0.59 |
