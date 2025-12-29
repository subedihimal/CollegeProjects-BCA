<?php
session_start();
if (!isset($_SESSION['email'])){
    header("Location: ../login/login.php");
    exit();
}

if (isset($_POST['logout'])) {
    session_destroy();
    header("Location: ../login/login.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $elapsedTime = $_POST['elapsedTime'];
  $username = $_SESSION['username'];

  $conn = mysqli_connect("localhost", "root", "", "8puzzle");
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}
$sql = "INSERT INTO timescore VALUES ('$username','$elapsedTime')";
$result = mysqli_query($conn, $sql);

}

?>
<html>
    <body>
    <script src="jquery.js"></script>
    </body>
</html>