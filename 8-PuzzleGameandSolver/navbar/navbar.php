<?php
if (isset($_POST['logout'])) {
    session_destroy();
    header("Location: ../login/login/login.php");
    exit();
}

?>

<link rel="stylesheet" href="navbar.css">
<nav class="navbar">
    <div class="logout">
        <form method="POST" style="display: inline;">
            <button class="logout-btn"type="submit" name="logout" style="background: none; border: none; cursor: pointer; padding: 0;">
                <img src="/8puzzle/navbar/icon/logout.png" alt="Logout" style="height: 40px; width: 40px;" />
            </button>
        </form>
    </div>
    <div class="navbar-title">8 Puzzle Game and Solver</div>
</nav>