<?php

require_once dirname(__DIR__) . '/config/bootstrap.php';

if (isset($_POST['verify_otp'])
    || isset($_POST['reset_password'])
) {
    app_start_session();
} elseif (isset($_GET['reset'])) {
    app_start_session(true);
}

$message = '';

// Handle Forgot Password and OTP Sending
if (isset($_POST["forgot_password"])) {
    $email = trim((string) ($_POST['email'] ?? ''));

    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $conn = app_database();
        $checkStatement = $conn->prepare('SELECT email FROM login WHERE email = ? LIMIT 1');
        $checkStatement->bind_param('s', $email);
        $checkStatement->execute();
        $rowCount = $checkStatement->get_result()->num_rows;
        $checkStatement->close();

        if ($rowCount == 0) {
            $message = 'No account was found with this email.';
        } else {
            app_start_session();

            // Generate OTP
            $otp = random_int(100000, 999999);
            $_SESSION['otp'] = $otp;
            $_SESSION['mail'] = $email;
            $_SESSION['otp_expiration'] = time() + 240; // OTP valid for 240 seconds (4 minutes)

            try {
                $mail = app_mailer();
                $mail->addAddress($email);
                $mail->Subject = 'Your Password Reset Code';
                $mail->Body = "<p>Dear user,</p><h3>Your password reset OTP code is: {$otp}</h3><br><p>Regards,<br><b>8-Puzzle Solver</b></p>";
                $mail->send();

                // Redirect to OTP verification section
                session_write_close();
                header('Location: /login/forgotPassword.php?otp=1', true, 303);
                exit();
            } catch (Throwable $exception) {
                error_log((string) $exception);
                unset($_SESSION['otp'], $_SESSION['mail'], $_SESSION['otp_expiration']);
                $message = 'The reset email could not be sent. Check the mail configuration.';
            }
        }
    } else {
        $message = 'Enter a valid email address.';
    }
}

// Handle OTP Verification and Password Reset
if (isset($_POST['verify_otp'])) {
    // Check if OTP is correct and still valid
    $expiresAt = (int) ($_SESSION['otp_expiration'] ?? 0);
    $submittedOtp = (string) ($_POST['otp'] ?? '');
    $storedOtp = (string) ($_SESSION['otp'] ?? '');

    if ($expiresAt === 0 || time() > $expiresAt) {
        session_write_close();
        header('Location: /login/forgotPassword.php?error=expired_otp', true, 303);
        exit();
    } elseif ($storedOtp !== '' && hash_equals($storedOtp, $submittedOtp)) {
        // Allow the user to change password
        $_SESSION['otp_verified'] = true;
        session_write_close();
        header('Location: /login/forgotPassword.php?reset=1', true, 303);
        exit();
    } else {
        session_write_close();
        header('Location: /login/forgotPassword.php?otp=1&error=invalid_otp', true, 303);
        exit();
    }
}

if (isset($_GET['reset']) && empty($_SESSION['otp_verified'])) {
    header('Location: /login/forgotPassword.php');
    exit();
}

// Handle Password Update after OTP Verification
if (isset($_POST['reset_password']) && !empty($_SESSION['otp_verified'])) {
    $new_password = (string) ($_POST['new_password'] ?? '');
    $email = (string) ($_SESSION['mail'] ?? '');

    if (strlen($new_password) < 8) {
        $message = 'Password must contain at least 8 characters.';
    } else {
        $password_hash = password_hash($new_password, PASSWORD_DEFAULT);

        // Update the password in the database
        $conn = app_database();
        $stmt = $conn->prepare('UPDATE login SET password = ? WHERE email = ?');
        $stmt->bind_param('ss', $password_hash, $email);

        if ($stmt->execute()) {
            $stmt->close();
            unset($_SESSION['otp'], $_SESSION['mail'], $_SESSION['otp_verified'], $_SESSION['otp_expiration']);
            session_write_close();
            header('Location: /login/login/login.php?reset=1', true, 303);
            exit();
        }

        $message = 'Password reset failed. Please try again.';
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
    <link rel="stylesheet" href="/login/css/style.css">
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
                window.location.replace('/login/forgotPassword.php');
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
                            <?php if ($message !== ''): ?>
                                <p class="text-center" style="color: red;"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></p>
                            <?php endif; ?>
                            <?php if (($_GET['error'] ?? '') === 'expired_otp'): ?>
                                <p class="text-center" style="color: red;">The OTP expired. Please request a new one.</p>
                            <?php endif; ?>
                            <form action="/login/forgotPassword.php" method="POST">
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
                            <p class="text-center">Go to <a href="/login/login/login.php">Sign In</a></p>
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
                            <?php if (($_GET['error'] ?? '') === 'invalid_otp'): ?>
                                <p style="color:red;">Invalid OTP. Please try again.</p>
                            <?php endif; ?>
                            <form action="/login/forgotPassword.php" method="POST">
                                <div class="form-group" id="otp-section">
                                    <label class="label" for="otp">Enter OTP:</label>
                                    <input type="number" name="otp" id="otp-input" class="form-control" required />
                                </div>
                                <div class="form-group">
                                    <button type="submit" id="verify-otp-btn" name="verify_otp" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
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
                            <?php if ($message !== ''): ?>
                                <p class="text-center" style="color: red;"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></p>
                            <?php endif; ?>
                            <form action="/login/forgotPassword.php?reset=1" method="POST">
                                <div class="form-group">
                                    <label class="label" for="new_password">New Password:</label>
                                    <input type="password" name="new_password" class="form-control" minlength="8" required />
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
