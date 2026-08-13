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

## Deploying to Vercel

The project is configured as one PHP serverless function using the community
`vercel-php` runtime. Static CSS, JavaScript, fonts, and images continue to be
served directly by Vercel.

### 1. Create the database

Create a publicly reachable MySQL-compatible database and import `8puzzle.sql`.
The database must contain the `app_sessions` table because Vercel functions do
not have persistent local session storage.

If you already imported an older version of the schema, run:

```sql
CREATE TABLE app_sessions (
  id varchar(128) NOT NULL PRIMARY KEY,
  data longblob NOT NULL,
  last_activity int unsigned NOT NULL,
  KEY last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Configure environment variables

Copy `.env.example` to `.env` for local development and fill in the values.
Never commit `.env`. In Vercel, add the same variables under **Project
Settings → Environment Variables** for Production, Preview, and Development as
needed.

Set `APP_ENV=production`, `APP_DEBUG=false`, and normally `DB_SSL=true` in
Vercel. `DB_SSL_CA` is optional unless the database provider gives you a CA
certificate path.

### 3. Install and run locally

PHP 8.2+, Composer, and MySQL are required.

```bash
composer install
cp .env.example .env
php -S localhost:8000 api/index.php
```

The local PHP command above uses the same front controller as Vercel. Open
`http://localhost:8000`.

### 4. Deploy

Push the repository to GitHub, import it into Vercel, add the environment
variables, and deploy. No framework preset or build command is required;
`vercel.json` selects the PHP runtime and defines the routes.

The SQL dump and local environment files are excluded from Vercel deployments.
