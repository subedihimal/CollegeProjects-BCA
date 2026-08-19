<?php
require_once dirname(__DIR__) . '/config/bootstrap.php';

$user = app_auth_user();
if ($user === null) {
    header('Location: /login/login/login.php');
    exit();
}

$conn = app_database();

// Fetch top 5 least timescores
$sql = "SELECT name, times FROM timescore ORDER BY times ASC LIMIT 8";
$result = $conn->query($sql);

// Store top 5 timescores in an array
$topScores = [];
if ($result) {
    while ($row = mysqli_fetch_assoc($result)) {
        $topScores[] = $row;
    }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <title>8-Puzzle Game</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/game/_8_Puzzle_game.css">
  <link rel="stylesheet" href="/game/model.css">
  <link rel="stylesheet" href="/navbar/navbar.css">
</head>

<body>
<?php include dirname(__DIR__) . '/navbar/navbar.php'; ?>
  <main class="game-layout">
    <section class="game-main" aria-label="8-Puzzle game board">
      <div id="timer" aria-live="polite">00:00</div>
      <div id="game_area" aria-label="Puzzle tiles"></div>
      <div id="game_controls">
        <button class="btn backHome solver_btn" onclick="location.href='/solver/_8_puzzle.php'">Solver</button>
      </div>
    </section>

    <section id="top_scores" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">Leaderboard</h2>
      <ul>
          <?php
          if (!empty($topScores)) {
              $rank = 1;
              foreach ($topScores as $score) {
                  echo "<li>
                          <span class='rank'>";
                  if ($rank == 1) {
                      echo "<img src='/game/icon/gold.png' class='medal' alt='Gold Medal' />";
                  } elseif ($rank == 2) {
                      echo "<img src='/game/icon/silver.png' class='medal' alt='Silver Medal' />";
                  } elseif ($rank == 3) {
                      echo "<img src='/game/icon/bronze.png' class='medal' alt='Bronze Medal' />";
                  } else {
                      echo "#" . $rank;
                  }
                  echo "</span>
                          <span class='player_name'>" . htmlspecialchars($score['name']) . "</span>
                          <span class='score_time'>" . htmlspecialchars(substr($score['times'], 0, 5)) . "</span></li>";
                  $rank++;
              }
          } else {
              echo "<li>No scores available.</li>";
          }
          ?>
      </ul>
    </section>

    <section id="how_to_play_container" aria-labelledby="instructions-title">
      <h2 id="instructions-title">How to Play the 8-Puzzle Game</h2>
      <ol>
          <li><strong>Goal:</strong> Arrange the tiles from 1 to 8 with the empty black tile in the bottom-right corner.</li>
          <li><strong>Move Tiles:</strong> Tap any tile next to the empty space to slide it into place.</li>
          <li><strong>Think Ahead:</strong> Every move counts, so plan before moving a tile.</li>
          <li><strong>Helpful Buttons:</strong>
              <ul>
                  <li><strong>Reset:</strong> Start again with a fresh puzzle.</li>
                  <li><strong>Solver:</strong> Open the solver with the current puzzle.</li>
              </ul>
          </li>
          <li><strong>Challenge Yourself:</strong> Finish quickly to earn a place on the leaderboard.</li>
      </ol>
    </section>
  </main>
  
  <script src="/game/_8_Puzzle_game.js"></script>
</body>

</html>
