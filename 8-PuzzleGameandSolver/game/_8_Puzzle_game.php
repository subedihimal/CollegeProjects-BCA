<?php
session_start();
if (!isset($_SESSION['email'])) {
    header("Location: ../login/login/login.php");
    exit();
}


// Database connection
$conn = mysqli_connect("localhost", "root", "", "8puzzle");
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

// Fetch top 5 least timescores
$sql = "SELECT name, times FROM timescore ORDER BY times ASC LIMIT 8";
$result = mysqli_query($conn, $sql);

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
  <link rel="stylesheet" href="_8_Puzzle_game.css">
  <link rel="stylesheet" href="model.css">
  <link rel="stylesheet" href="../navbar/navbar.css">
  <style>
    /* Additional CSS for the top scores section */
    #top_scores {
      position: absolute;
      right: 10px;
      top: 100px;
      background-color: white;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      width: 300px;
    }
    #top_scores h2 {
      text-align: center;
    }
    #top_scores ul {
      list-style-type: none;
      padding: 0;
    }
    #top_scores li {
      margin: 5px 0;
    }
    #top_scores .rank {
      text-align: center;
    }
  </style>
</head>

<body style="background-color: grey;">
<?php include('../navbar/navbar.php'); ?>
  <div id="how_to_play_container">
    <h2>How to Play the 8-Puzzle Game</h2>
    <ol>
        <li><strong>Goal:</strong> Arrange the tiles from 1 to 8 with the empty black tile in the bottom-right corner. Sounds easy? Let’s see if you can do it!</li>
        <li><strong>Move Tiles:</strong> Click on any tile next to the empty space, and it’ll slide right in. Keep sliding until they’re all lined up perfectly.</li>
        <li><strong>Think Ahead:</strong> Every move counts! Can you shuffle the tiles while keeping the puzzle under control?</li>
        <li><strong>Helpful Buttons:</strong>
            <ul>
                <li><strong>Reset:</strong> Press to start fresh if things get messy.</li>
                <li><strong>Solve:</strong> Click to see the magic happen—but beware, it might take the thrill away!</li>
            </ul>
        </li>
        <li><strong>Challenge Yourself:</strong> Solve the puzzle faster than anyone else and get your name on the <em>leaderboard</em>! Show the world you're the 8-puzzle master. Are you ready for the challenge?</li>
    </ol>
</div>
  
  <!-- Top Scores Section -->
<div id="top_scores">
    <h2>Leader Boards</h2>
    <ul>
        <?php
        if (!empty($topScores)) {
            $rank = 1;
            foreach ($topScores as $score) {
                echo "<li>
                        <span class='rank'>";
                // Display medal for top 3 and omit rank number
                if ($rank == 1) {
                    echo "<img src='icon/gold.png' class='medal' alt='Gold Medal' />";
                } elseif ($rank == 2) {
                    echo "<img src='icon/silver.png' class='medal' alt='Silver Medal' />";
                } elseif ($rank == 3) {
                    echo "<img src='icon/bronze.png' class='medal' alt='Bronze Medal' />";
                } else {
                    echo "#" . $rank; // Show rank for others
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
</div>
  

  <div id="timer">00:00</div> 
  <div id="game_area">
  </div>
  <div id="game_controls">
    <button class="btn backHome solver_btn" onclick="location.href='../solver/_8_puzzle.php'">Solver</button>
  </div>
  
  <script src="_8_Puzzle_game.js"></script>
</body>

</html>
