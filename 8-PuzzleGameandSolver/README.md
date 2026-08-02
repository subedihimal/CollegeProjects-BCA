# 8-Puzzle Game and Solver

A web-based application combining a playable 8-Puzzle game with an intelligent solver that uses the A* search algorithm to find and visualize optimal solutions in real time.

## Overview

The 8-Puzzle is a sliding tile puzzle where numbered tiles are arranged in a 3x3 grid by sliding them into an empty space. This project pairs a competitive puzzle game with an educational solver, letting users experience the puzzle firsthand while observing how a pathfinding algorithm solves it step by step.

## Features

- **Solvability-checked puzzle generation** — puzzles are validated via inversion count before being served, guaranteeing every generated configuration is solvable
- **Timer-based scoring** — completion time is recorded per user and used for ranking
- **Leaderboard** — surfaces the top 8 fastest completions
- **A\*-powered solver** — solves any valid configuration (randomly generated or manually entered) and animates the full solution path
- **Manual puzzle input** — users can define custom configurations for the solver to analyze

## Algorithm

The solver is built on **A\* search**:

```
f(n) = g(n) + h(n)
```

- **g(n)** — depth of the current node (moves made so far)
- **h(n)** — heuristic estimate to the goal, computed via **Manhattan Distance**

**Process:**
1. Verify solvability using inversion count (even = solvable, odd = reshuffle)
2. Generate neighboring states by moving the blank tile in valid directions
3. Score each state with `f(n)` and expand the lowest-scoring state first via a priority queue (open set)
4. Track fully explored states in a closed set to avoid redundant work
5. Repeat until the goal state is reached or the iteration limit is exceeded
6. Reconstruct and animate the solution path from goal to initial state

## Tech Stack

- **XAMPP** — local server environment (Apache + MySQL)
- **Visual Studio Code** — development environment
- **HTML / CSS / JavaScript** — frontend and game logic
- **PHP / MySQL** — backend, user accounts, and leaderboard storage
