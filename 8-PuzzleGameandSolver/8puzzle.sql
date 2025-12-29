-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 30, 2024 at 09:37 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `8puzzle`
--

-- --------------------------------------------------------

--
-- Table structure for table `login`
--

CREATE TABLE `login` (
  `email` varchar(225) NOT NULL,
  `name` varchar(225) DEFAULT NULL,
  `password` varchar(225) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `login`
--

INSERT INTO `login` (`email`, `name`, `password`) VALUES
('gamingmains@gmail.com', 'Shyam', '202cb962ac59075b964b07152d234b70'),
('himal.radiant@gmail.com', 'Nripesh', '202cb962ac59075b964b07152d234b70'),
('itissubedi@gmail.com', 'Himal', '202cb962ac59075b964b07152d234b70'),
('yatriwears@gmail.com', 'Sagar', '202cb962ac59075b964b07152d234b70');

-- --------------------------------------------------------

--
-- Table structure for table `timescore`
--

CREATE TABLE `timescore` (
  `name` varchar(225) DEFAULT NULL,
  `times` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `timescore`
--

INSERT INTO `timescore` (`name`, `times`) VALUES
('Himal', '00:33:00'),
('Shyam', '00:39:00'),
('Sagar', '02:22:00'),
('Nripesh', '00:23:00'),
('Himal', '00:30:00'),
('Shyam', '00:52:00'),
('Sagar', '00:50:00'),
('Shyam', '00:43:00'),
('Nripesh', '00:40:00'),
('Nripesh', '01:57:00'),
('Nripesh', '01:30:00'),
('Nripesh', '00:49:00'),
('Nripesh', '00:39:00');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `login`
--
ALTER TABLE `login`
  ADD PRIMARY KEY (`email`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `timescore`
--
ALTER TABLE `timescore`
  ADD KEY `name` (`name`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `timescore`
--
ALTER TABLE `timescore`
  ADD CONSTRAINT `timescore_ibfk_1` FOREIGN KEY (`name`) REFERENCES `login` (`name`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
