<?php
session_start();

// Database Connection
$conn = mysqli_connect("localhost", "root", "", "8puzzle");
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}
$message =  "";
if (isset($_POST['login'])) {
    $inputEmail = $_POST['email'];
    $inputPassword = md5($_POST['password']);
    
    $sql = "SELECT name FROM login WHERE email = '$inputEmail' AND password = '$inputPassword'";
    $result = mysqli_query($conn, $sql);
    
    if (mysqli_num_rows($result) == 1) {
        $row = mysqli_fetch_assoc($result);
        $_SESSION['email'] = $inputEmail;
        $_SESSION['username'] = $row['name'];
        header("Location: ../../game/_8_Puzzle_game.php");
        exit();
    } else {
        $message = "Invalid username or password.";      
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Login</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="vendor/bootstrap/css/bootstrap.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="fonts/font-awesome-4.7.0/css/font-awesome.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="fonts/iconic/css/material-design-iconic-font.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="vendor/animate/animate.css">
    <!--===============================================================================================-->    
    <link rel="stylesheet" type="text/css" href="vendor/css-hamburgers/hamburgers.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="vendor/animsition/css/animsition.min.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="vendor/select2/select2.min.css">
    <!--===============================================================================================-->    
    <link rel="stylesheet" type="text/css" href="vendor/daterangepicker/daterangepicker.css">
    <!--===============================================================================================-->
    <link rel="stylesheet" type="text/css" href="css/util.css">
    <link rel="stylesheet" type="text/css" href="css/main.css">
    <!--===============================================================================================-->
</head>
<body>
    
    <div class="limiter">
        <div class="container-login100">
            <div class="wrap-login100">
                <form action="login.php" method="POST" class="login100-form validate-form">
                    <span class="login100-form-title p-b-26">
                        8 Puzzle Game Login
                    </span>
                    

                    <div class="wrap-input100 validate-input" data-validate="Valid email is: a@b.c">
                        <input class="input100" type="text" name="email" required>
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
                                <?php echo $message; ?>
                            </span>
                        </div>
                    <?php endif; ?>
                    <a class="txt2" href="../forgotPassword.php" style="color:#ff6666;">
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
                        <a class="txt2" href="../register.php">
                            Sign Up
                        </a>
                    </div>
                </form>
            </div>
        </div>
    </div>

</body>
</html>
