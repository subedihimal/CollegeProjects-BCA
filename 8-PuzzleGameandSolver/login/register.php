<?php 
session_start();

// Database Connection
$conn = mysqli_connect("localhost", "root", "", "8puzzle");
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

// Handle Registration and OTP Sending
if (isset($_POST["register"])) {
    $email = $_POST["email"];
    $username = $_POST["username"];
    $password = $_POST["password"];

    // Check if email already exists
    $check_query = mysqli_query($conn, "SELECT * FROM login WHERE email ='$email'");
    $rowCount = mysqli_num_rows($check_query);

    if (!empty($email) && !empty($password)) {
        if ($rowCount > 0) {
            echo "<script>alert('User with email already exists!');</script>";
        } else {
            // Generate OTP
            $otp = rand(100000, 999999);
            $_SESSION['otp'] = $otp;
            $_SESSION['mail'] = $email;
            $_SESSION['username'] = $username;
            $_SESSION['password'] = md5($password); // Store password hash for later use
            $_SESSION['otp_expiration'] = time() + 240; // OTP valid for 240 seconds (4 minutes)

            // Include PHPMailer
            require "phpmailer/PHPMailerAutoload.php";
            $mail = new PHPMailer;

            // Mail server configuration
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com';
            $mail->Port = 587;
            $mail->SMTPAuth = true;
            $mail->SMTPSecure = 'tls';

            $mail->Username = 'gamingmains@gmail.com';
            $mail->Password = 'ryotxxxlyhtgxubv';

            $mail->setFrom('gamingmains@gmail.com', 'OTP Verification');
            $mail->addAddress($email);

            $mail->isHTML(true);
            $mail->Subject = "Your Verification Code";
            $mail->Body = "<p>Dear $username,</p><h3>Your verification OTP code is: $otp</h3><br><p>Regards,<br><b>8puzzle Solver</b></p>";

            if (!$mail->send()) {
                echo "<script>alert('Registration failed, invalid email.');</script>";
            } else {
                // Redirect to OTP verification section
                header("Location: register.php?otp=1");
                exit();
            }
        }
    }
}

// Handle OTP Verification
if (isset($_POST['verify_otp'])) {
    // Check if OTP is correct and still valid
    if (time() > $_SESSION['otp_expiration']) {
        echo "<script>alert('OTP has expired. Please request a new one.'); window.location.replace('register.php');</script>";
    } elseif ($_POST['otp'] == $_SESSION['otp']) {
        // Proceed with registration by inserting into the database
        $email = $_SESSION['mail'];
        $username = $_SESSION['username'];
        $password_hash = $_SESSION['password'];

        // Use prepared statements to prevent SQL injection
        $stmt = $conn->prepare("INSERT INTO login (email, name, password) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $email, $username, $password_hash);
        
        if ($stmt->execute()) {
            echo "<script>alert('Registration successful!'); window.location.replace('login/login.php');</script>";
        } else {
            echo "<script>alert('Registration failed, please try again.'); window.location.replace('register.php');</script>";
        }

        // Clear session variables
        unset($_SESSION['otp']);
        unset($_SESSION['mail']);
        unset($_SESSION['username']);
        unset($_SESSION['password']);
    } else {
        // Show alert for invalid OTP and redirect to register.php
        echo "<script>alert('Invalid OTP. Please try again.'); window.location.replace('register.php');</script>";
        exit();
    }
}

?>

<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="css/style.css"> <!-- Include your style.css here -->
    <link rel="icon" href="Favicon.png">
    <title>Register</title>
</head>
<script>
    // Timer for OTP (4 minutes)
    function startOtpTimer() {
        var timer = 240; // 240 seconds (4 minutes)
        var countdownElement = document.getElementById("otp-timer");

        var interval = setInterval(function() {
            var minutes = Math.floor(timer / 60);
            var seconds = timer % 60;
            countdownElement.innerHTML = "Time remaining: " + minutes + "m " + (seconds < 10 ? "0" + seconds : seconds) + "s";

            if (timer-- <= 0) {
                clearInterval(interval);
                alert("OTP has expired. Please request a new one.");
                window.location.replace('register.php');
            }
        }, 1000);
    }

    window.onload = function() {
        if (document.getElementById("otp-section")) {
            startOtpTimer();
        }
    };
</script>
<body>
    <section class="ftco-section">
        <div class="container">
            <?php if (!isset($_GET['otp'])): ?>
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center mb-5">
                        <h2 class="heading-section">8-Puzzle Create Account</h2>
                    </div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="login-wrap p-4 p-md-5">
                            <form action="register.php" method="POST">
                                <div class="form-group">
                                    <label class="label" for="email">Email:</label>
                                    <input type="email" name="email" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label class="label" for="username">Username:</label>
                                    <input type="text" name="username" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label class="label" for="password">Password:</label>
                                    <input type="password" name="password" class="form-control" required>
                                </div>
                                <div class="form-group d-flex justify-content-end mt-5">
                                    <button type="submit" name="register" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                            </form>
                            <p class="text-center">Already have an account? <a href="login/login.php">Sign In</a></p>
                        </div>
                    </div>
                </div>
            <?php else: ?>
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center mb-5">
                        <h2 class="heading-section">Verify OTP</h2>
                        <p id="otp-timer" style="color: red;"></p> <!-- Timer Display -->
                    </div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="login-wrap p-4 p-md-5">
                            <form action="register.php" method="POST">
                                <div class="form-group" id="otp-section">
                                    <label class="label" for="otp">Enter OTP:</label>
                                    <input type="number" name="otp" class="form-control" required />
                                </div>
                                <div class="form-group">
                                    <button type="submit" name="verify_otp" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                                <?php if (isset($_GET['error']) && $_GET['error'] == 'invalid_otp') echo "<p style='color:red;'>Invalid OTP. Please try again.</p>"; ?>
                            </form>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </section>

</body>
</html>
