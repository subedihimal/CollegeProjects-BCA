<?php

require_once dirname(__DIR__) . '/config/bootstrap.php';

if (isset($_POST['verify_otp'])) {
    app_start_session();
}

$message = '';

$clearPendingRegistration = static function (): void {
    unset(
        $_SESSION['otp'],
        $_SESSION['mail'],
        $_SESSION['username'],
        $_SESSION['password'],
        $_SESSION['otp_expiration']
    );
};

$redirectAfterRegistration = static function () use ($clearPendingRegistration): never {
    $clearPendingRegistration();
    $_SESSION['registration_completed_at'] = time();
    session_write_close();
    header('Location: /login/login/login.php?registered=1', true, 303);
    exit();
};

// Handle Registration and OTP Sending
if (isset($_POST["register"])) {
    $email = trim((string) ($_POST['email'] ?? ''));
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = 'Enter a valid email address.';
    } elseif ($username === '') {
        $message = 'Username is required.';
    } elseif (strlen($password) < 8) {
        $message = 'Password must contain at least 8 characters.';
    } else {
        $conn = app_database();
        $checkStatement = $conn->prepare('SELECT email FROM login WHERE email = ? LIMIT 1');
        $checkStatement->bind_param('s', $email);
        $checkStatement->execute();
        $rowCount = $checkStatement->get_result()->num_rows;
        $checkStatement->close();

        if ($rowCount > 0) {
            $message = 'An account with this email already exists.';
        } else {
            app_start_session();
            unset($_SESSION['registration_completed_at']);

            // Generate OTP
            $otp = random_int(100000, 999999);
            $_SESSION['otp'] = $otp;
            $_SESSION['mail'] = $email;
            $_SESSION['username'] = $username;
            $_SESSION['password'] = password_hash($password, PASSWORD_DEFAULT);
            $_SESSION['otp_expiration'] = time() + 240; // OTP valid for 240 seconds (4 minutes)

            try {
                $mail = app_mailer();
                $mail->addAddress($email);
                $mail->Subject = 'Your Verification Code';
                $safeUsername = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
                $mail->Body = "<p>Dear {$safeUsername},</p><h3>Your verification OTP code is: {$otp}</h3><br><p>Regards,<br><b>8-Puzzle Solver</b></p>";
                $mail->send();

                // Redirect to OTP verification section
                session_write_close();
                header('Location: /login/register.php?otp=1', true, 303);
                exit();
            } catch (Throwable $exception) {
                error_log((string) $exception);
                $clearPendingRegistration();
                $message = 'Registration email could not be sent. Check the mail configuration.';
            }
        }
    }
}

// Handle OTP Verification
if (isset($_POST['verify_otp'])) {
    $completedAt = (int) ($_SESSION['registration_completed_at'] ?? 0);
    if ($completedAt >= time() - 600) {
        $redirectAfterRegistration();
    }

    // Check if OTP is correct and still valid
    $expiresAt = (int) ($_SESSION['otp_expiration'] ?? 0);
    $submittedOtp = (string) ($_POST['otp'] ?? '');
    $storedOtp = (string) ($_SESSION['otp'] ?? '');

    if ($expiresAt === 0 || time() > $expiresAt) {
        $clearPendingRegistration();
        session_write_close();
        header('Location: /login/register.php?error=expired_otp', true, 303);
        exit();
    } elseif ($storedOtp !== '' && hash_equals($storedOtp, $submittedOtp)) {
        // Proceed with registration by inserting into the database
        $email = (string) ($_SESSION['mail'] ?? '');
        $username = (string) ($_SESSION['username'] ?? '');
        $password_hash = (string) ($_SESSION['password'] ?? '');

        // Use prepared statements to prevent SQL injection
        $conn = app_database();
        $stmt = $conn->prepare("INSERT INTO login (email, name, password) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $email, $username, $password_hash);

        try {
            $stmt->execute();
        } catch (mysqli_sql_exception $exception) {
            error_log((string) $exception);
            $stmt->close();

            // A double click or retried serverless request may arrive after the
            // first request has already created this exact account. Treat that
            // case as the same successful registration instead of an OTP error.
            $existingStatement = $conn->prepare(
                'SELECT email FROM login WHERE email = ? AND name = ? AND password = ? LIMIT 1'
            );
            $existingStatement->bind_param('sss', $email, $username, $password_hash);
            $existingStatement->execute();
            $accountExists = $existingStatement->get_result()->fetch_assoc() !== null;
            $existingStatement->close();

            if ($accountExists) {
                $redirectAfterRegistration();
            }

            $message = 'Registration failed. The email or username may already be in use.';
        }

        if ($message === '') {
            $stmt->close();
            $redirectAfterRegistration();
        }
    } else {
        session_write_close();
        header('Location: /login/register.php?otp=1&error=invalid_otp', true, 303);
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
    <link rel="stylesheet" href="/login/css/style.css">
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
                window.location.replace('/login/register.php');
            }
        }, 1000);
    }

    window.onload = function() {
        if (document.getElementById("otp-section")) {
            startOtpTimer();
        }

        var otpForm = document.getElementById("otp-form");
        if (otpForm) {
            otpForm.addEventListener("submit", function() {
                document.getElementById("verify-otp-btn").disabled = true;
            });
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
                            <?php if ($message !== ''): ?>
                                <p class="text-center" style="color: red;"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></p>
                            <?php endif; ?>
                            <?php if (($_GET['error'] ?? '') === 'expired_otp'): ?>
                                <p class="text-center" style="color: red;">The OTP expired. Please request a new one.</p>
                            <?php endif; ?>
                            <form action="/login/register.php" method="POST">
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
                                    <input type="password" name="password" class="form-control" minlength="8" required>
                                </div>
                                <div class="form-group d-flex justify-content-end mt-5">
                                    <button type="submit" name="register" class="btn btn-primary submit">
                                        <span class="fa fa-paper-plane"></span> <!-- Arrow icon -->
                                    </button>
                                </div>
                            </form>
                            <p class="text-center">Already have an account? <a href="/login/login/login.php">Sign In</a></p>
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
                            <?php if (($_GET['error'] ?? '') === 'invalid_otp'): ?>
                                <p style="color:red;">Invalid OTP. Please try again.</p>
                            <?php endif; ?>
                            <form action="/login/register.php" method="POST" id="otp-form">
                                <input type="hidden" name="verify_otp" value="1">
                                <div class="form-group" id="otp-section">
                                    <label class="label" for="otp">Enter OTP:</label>
                                    <input type="number" name="otp" class="form-control" required />
                                </div>
                                <div class="form-group">
                                    <button type="submit" id="verify-otp-btn" class="btn btn-primary submit">
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
