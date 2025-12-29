<?php 
session_start();

// Database Connection
$conn = mysqli_connect("localhost", "root", "", "8puzzle");
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

// Handle Forgot Password and OTP Sending
if (isset($_POST["forgot_password"])) {
    $email = $_POST["email"];

    // Check if email exists
    $check_query = mysqli_query($conn, "SELECT * FROM login WHERE email ='$email'");
    $rowCount = mysqli_num_rows($check_query);

    if (!empty($email)) {
        if ($rowCount == 0) {
            echo "<script>alert('No account found with this email!');</script>";
        } else {
            // Generate OTP
            $otp = rand(100000, 999999);
            $_SESSION['otp'] = $otp;
            $_SESSION['mail'] = $email;
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
            $mail->Body = "<p>Dear user,</p><h3>Your password reset OTP code is: $otp</h3><br><p>Regards,<br><b>8puzzle Solver</b></p>";

            if (!$mail->send()) {
                echo "<script>alert('Failed to send OTP, please try again.');</script>";
            } else {
                // Redirect to OTP verification section
                header("Location: forgotpassword.php?otp=1");
                exit();
            }
        }
    }
}

// Handle OTP Verification and Password Reset
if (isset($_POST['verify_otp'])) {
    // Check if OTP is correct and still valid
    if (time() > $_SESSION['otp_expiration']) {
        echo "<script>alert('OTP has expired. Please request a new one.'); window.location.replace('forgotpassword.php');</script>";
    } elseif ($_POST['otp'] == $_SESSION['otp']) {
        // Allow the user to change password
        $_SESSION['otp_verified'] = true;
        header("Location: forgotpassword.php?reset=1");
        exit();
    } else {
        echo "<script>alert('Invalid OTP. Please try again.'); window.location.replace('forgotpassword.php');</script>";
        exit();
    }
}

// Handle Password Update after OTP Verification
if (isset($_POST['reset_password']) && isset($_SESSION['otp_verified']) && $_SESSION['otp_verified']) {
    $new_password = $_POST['new_password'];
    $email = $_SESSION['mail'];
    $password_hash = md5($new_password);

    // Update the password in the database
    $stmt = $conn->prepare("UPDATE login SET password=? WHERE email=?");
    $stmt->bind_param("ss", $password_hash, $email);

    if ($stmt->execute()) {
        echo "<script>alert('Password reset successful!'); window.location.replace('login/login.php');</script>";
    } else {
        echo "<script>alert('Password reset failed, please try again.'); window.location.replace('forgotpassword.php');</script>";
    }

    // Clear session variables
    unset($_SESSION['otp']);
    unset($_SESSION['mail']);
    unset($_SESSION['otp_verified']);
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
    <title>Forgot Password</title>
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
                window.location.replace('forgotpassword.php');
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
            <?php if (!isset($_GET['otp']) && !isset($_GET['reset'])): ?>
                <!-- Email Input Section -->
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center mb-5">
                        <h2 class="heading-section">Forgot Password</h2>
                    </div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="login-wrap p-4 p-md-5">
                            <form action="forgotpassword.php" method="POST">
                                <div class="form-group">
                                    <label class="label" for="email">Email:</label>
                                    <input type="email" name="email" class="form-control" required>
                                </div>
                                <div class="form-group d-flex justify-content-end mt-5">
                                    <button type="submit" name="forgot_password" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                            </form>
                            <p class="text-center">Go to <a href="login/login.php">Sign In</a></p>
                        </div>
                    </div>
                </div>
            <?php elseif (isset($_GET['otp'])): ?>
                <!-- OTP Verification Section -->
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center mb-5">
                        <h2 class="heading-section">Verify OTP</h2>
                        <p id="otp-timer" style="color: red;"></p> <!-- Timer Display -->
                    </div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="login-wrap p-4 p-md-5">
                            <form action="forgotpassword.php" method="POST">
                                <div class="form-group" id="otp-section">
                                    <label class="label" for="otp">Enter OTP:</label>
                                    <input type="number" name="otp" id="otp-input" class="form-control" required />
                                </div>
                                <div class="form-group">
                                    <button type="submit" id="verify-otp-btn" name="verify_otp" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                                <?php if (isset($_GET['error']) && $_GET['error'] == 'invalid_otp') echo "<p style='color:red;'>Invalid OTP. Please try again.</p>"; ?>
                            </form>
                        </div>
                    </div>
                </div>
            <?php elseif (isset($_GET['reset'])): ?>
                <!-- Password Reset Section -->
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center mb-5">
                        <h2 class="heading-section">Reset Password</h2>
                    </div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="login-wrap p-4 p-md-5">
                            <form action="forgotpassword.php" method="POST">
                                <div class="form-group">
                                    <label class="label" for="new_password">New Password:</label>
                                    <input type="password" name="new_password" class="form-control" required />
                                </div>
                                <div class="form-group">
                                    <button type="submit" name="reset_password" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </section>

</body>
</html>
