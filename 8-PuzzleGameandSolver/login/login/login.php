<?php

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

app_start_session();
$conn = app_database();
$message = '';

if (isset($_POST['login'])) {
    $inputEmail = trim((string) ($_POST['email'] ?? ''));
    $inputPassword = (string) ($_POST['password'] ?? '');

    $statement = $conn->prepare('SELECT name, password FROM login WHERE email = ? LIMIT 1');
    $statement->bind_param('s', $inputEmail);
    $statement->execute();
    $row = $statement->get_result()->fetch_assoc();
    $statement->close();

    if ($row !== null && app_password_matches($inputPassword, (string) $row['password'])) {
        if (app_password_needs_upgrade((string) $row['password'])) {
            $newHash = password_hash($inputPassword, PASSWORD_DEFAULT);
            $upgrade = $conn->prepare('UPDATE login SET password = ? WHERE email = ?');
            $upgrade->bind_param('ss', $newHash, $inputEmail);
            $upgrade->execute();
            $upgrade->close();
        }

        session_regenerate_id(true);
        $_SESSION['email'] = $inputEmail;
        $_SESSION['username'] = $row['name'];
        header('Location: /game/_8_Puzzle_game.php');
        exit();
    } else {
        $message = 'Invalid email or password.';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Login</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <link rel="stylesheet" type="text/css" href="/login/login/fonts/font-awesome-4.7.0/css/font-awesome.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="/login/login/fonts/iconic/css/material-design-iconic-font.min.css">
    <link rel="stylesheet" type="text/css" href="/login/login/css/util.css">
    <link rel="stylesheet" type="text/css" href="/login/login/css/main.css">
    <!--===============================================================================================-->
</head>
<body>
    
    <div class="limiter">
        <div class="container-login100">
            <div class="wrap-login100">
                <form action="/login/login/login.php" method="POST" class="login100-form validate-form">
                    <span class="login100-form-title p-b-26">
                        8 Puzzle Game Login
                    </span>
                    

                    <div class="wrap-input100 validate-input" data-validate="Valid email is: a@b.c">
                        <input class="input100" type="email" name="email" required>
                        <span class="focus-input100" data-placeholder="Email"></span>
                    </div>

                    <div class="wrap-input100 validate-input" data-validate="Enter password">
                        <span class="btn-show-pass">
                            <i class="zmdi zmdi-eye"></i>
                        </span>
                        <input class="input100" type="password" name="password" required>
                        <span class="focus-input100" data-placeholder="Password"></span>
                    </div>

                    <!-- Display message if login fails -->
                    <?php if ($message): ?>
                        <div class="text-center p-t-12">
                            <span class="txt1" style="color:red;">
                                <?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?>
                            </span>
                        </div>
                    <?php endif; ?>
                    <a class="txt2" href="/login/forgotPassword.php" style="color:#ff6666;">
                            Forgot Password?
                        </a>

                    <div class="container-login100-form-btn">
                        <div class="wrap-login100-form-btn">
                            <div class="login100-form-bgbtn"></div>
                            <input type="submit" name="login" class="login100-form-btn" value="Login">
                        </div>
                    </div>

                    <div class="text-center p-t-115">
                        <span class="txt1">
                            Don’t have an account?
                        </span>
                        <a class="txt2" href="/login/register.php">
                            Sign Up
                        </a>
                    </div>
                </form>
            </div>
        </div>
    </div>

</body>
</html>
