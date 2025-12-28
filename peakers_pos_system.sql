-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 01, 2025 at 09:59 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `peakers_pos_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(255) NOT NULL,
  `category_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `category_name`, `created_at`) VALUES
(2, 'Simba', '2025-02-27 15:08:04'),
(16, 'Curtains', '2025-03-03 19:30:44'),
(18, 'Locks', '2025-03-03 19:31:34'),
(25, 'Simbafour', '2025-03-03 19:54:01'),
(32, 'Simbafive', '2025-03-03 20:04:28'),
(34, 'Windows', '2025-03-03 20:19:43'),
(35, 'TestingCategory', '2025-05-19 15:09:35'),
(36, 'table', '2025-05-21 13:45:18'),
(38, 'clothes', '2025-05-28 04:56:33'),
(40, 'plastics', '2025-05-28 07:55:12'),
(41, 'food', '2025-06-19 12:14:02'),
(42, 'drinks', '2025-06-19 12:14:12'),
(43, 'lights', '2025-07-07 10:11:55'),
(44, 'tires', '2025-07-07 10:19:16'),
(45, 'seats', '2025-07-07 10:33:01'),
(46, 'Dashboards', '2025-07-07 13:24:20'),
(47, 'mirrorbikes', '2025-07-07 14:13:41');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `customer_id` int(255) NOT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`customer_id`, `customer_name`, `phone`, `email`, `address`, `created_at`) VALUES
(1, 'Cetric Samuel', '0700391535', 'scetric@gmail.com', 'Kiserian', '2025-02-25 17:19:07'),
(2, 'Alicia', 'Myra', 'alicia@gmail.com', 'kiserian', '2025-02-26 14:05:19'),
(3, 'Testing', '07123456778', 'testing@gmail.com', 'Nyeris', '2025-02-26 14:11:32'),
(4, 'Caleb Muli', '0700391535', 'caleb@gmail.com', 'Kiserian', '2025-02-26 14:12:23'),
(5, 'Virginia Muli', '12345678900', 'virginia@gmail.com', 'Kiserian', '2025-02-26 14:13:01'),
(6, 'Cetric Omwembe', '0718675454', 'cetric@gmail.comttt', 'Kiserian Kenya', '2025-02-26 14:17:41'),
(7, 'Samuel Omwembe', '0789234768', 'samuel@gmail.com', 'Kitengela', '2025-02-27 08:47:08'),
(8, 'Lexxy Omwembes', '0700654234', 'lexxy@gmail.com', 'Kiserians', '2025-02-27 20:12:18'),
(9, 'Testtest', '07893456543', 'testtest@gmail.com', 'Testarian', '2025-03-03 12:10:20'),
(10, 'Malian Kamau', '07003915300', 'scetric@gmail.commm', 'Kiserian', '2025-03-03 12:19:00'),
(11, 'Testtest Kamau', '070039153098', 'scetric@gmail.commms', 'Kiserian', '2025-03-03 12:37:26'),
(12, 'Cetric', '01445678', 'scetric@gmail.com', 'Yeeeys', '2025-03-03 13:00:40'),
(13, 'Njeru', '709893456', NULL, 'Kiserian', '2025-03-03 13:17:15'),
(14, 'Cetric Testing', '0700456745', '', 'N/A', '2025-03-03 13:17:44'),
(15, 'Cetric Test', 'N/A', '', 'N/A', '2025-03-03 14:06:55'),
(16, 'Why Why', 'N/A', '', 'N/A', '2025-03-03 14:07:10'),
(17, 'Whylet', 'N/A', '', 'N/A', '2025-03-03 14:11:37'),
(18, 'Kamau Wanja', '070039153578', 'scetric@gmail.comjk', 'Kiserian', '2025-03-03 17:16:21'),
(19, 'Wanjau Kamau', '0700391535', 'scetric@gmail.com', 'Kiserian', '2025-03-03 17:38:47'),
(20, 'Otieno Kevin', NULL, NULL, NULL, '2025-03-03 17:42:40'),
(21, 'Mark Odour', 'N/A', '', 'N/A', '2025-03-03 17:43:03'),
(22, 'Kamau Wafula', '0789009667', 'kamau@gmail.com', NULL, '2025-03-03 19:02:12'),
(23, 'CetricTest Customer', '07893456789', 'test@gmail.com', 'Gathiga', '2025-03-19 12:36:29'),
(24, 'AliciaTest Customer', NULL, NULL, NULL, '2025-03-19 13:40:23'),
(25, 'LexxyCustomer Test', NULL, NULL, NULL, '2025-03-19 15:54:26'),
(26, 'LexxyTest Customer', NULL, NULL, NULL, '2025-03-19 16:05:22'),
(27, 'MaliTest Customer', '078967583354', 'mali@gmail.com', 'Kariobangi', '2025-03-19 16:08:52'),
(28, 'Testingone Customer', '01894567846738', NULL, NULL, '2025-03-21 09:40:38'),
(29, 'cetricSam', NULL, NULL, NULL, '2025-03-21 11:08:03'),
(30, 'WhyNot Working', '07895673453', 'why@gmail.com', 'Kiserian', '2025-03-21 11:19:39'),
(31, 'Cetric', '09876633', NULL, NULL, '2025-05-01 09:49:13'),
(32, 'Zion', '0700546789', 'scetric@gmail.com', NULL, '2025-05-07 11:16:33'),
(33, 'Zion', '0700678656', 'scetric@ymail.com', NULL, '2025-05-07 11:18:56'),
(34, 'Mali Lexxy', '07894567863', '', 'N/A', '2025-05-07 11:25:16'),
(35, 'Omondi', 'N/A', '', 'N/A', '2025-05-07 11:25:55'),
(36, 'peoplePerson', 'N/A', '', 'N/A', '2025-05-07 12:43:40'),
(37, 'SettoTest', NULL, NULL, NULL, '2025-05-07 13:48:57'),
(38, 'Orienga', '0700457689756', '0ringa@gmail.coms', 'N/A', '2025-05-14 08:52:33'),
(39, 'Mulamu', '07893456789', 'mulama@gmail.com', 'N/A', '2025-05-14 09:04:22'),
(40, 'Maragwa', NULL, NULL, NULL, '2025-05-14 11:01:58'),
(41, 'MuragwaTesting', NULL, NULL, NULL, '2025-05-14 11:33:55'),
(42, 'MulangwaTesting', 'N/A', '', 'N/A', '2025-05-14 11:34:15'),
(43, 'Caleb', NULL, NULL, NULL, '2025-05-28 07:42:48'),
(44, 'caleb', NULL, NULL, NULL, '2025-05-28 07:49:38'),
(45, 'Samuel Omwembe', '254719585252', 'fish@gmail.com', 'it\'s optional', '2025-07-07 10:42:44'),
(46, 'Waweru Maina', '254719585252', 'fish@gmail.com', 'it\'s a customers', '2025-07-07 13:21:25'),
(47, 'William', 'N/A', '', 'N/A', '2025-07-07 14:21:14'),
(48, 'Wambui', 'N/A', '', 'N/A', '2025-07-10 17:58:47'),
(49, 'Sharon', 'N/A', '', 'N/A', '2025-07-10 18:26:22');

-- --------------------------------------------------------

--
-- Table structure for table `material_payments`
--

CREATE TABLE `material_payments` (
  `payment_id` int(11) NOT NULL,
  `supply_id` int(11) NOT NULL,
  `amount_paid` decimal(10,2) DEFAULT NULL,
  `payment_type` enum('Cash','Mpesa') NOT NULL,
  `payment_date` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `material_payments`
--

INSERT INTO `material_payments` (`payment_id`, `supply_id`, `amount_paid`, `payment_type`, `payment_date`) VALUES
(3, 1, 20000.00, 'Cash', '2025-06-16 20:59:24'),
(4, 1, 300000.00, 'Mpesa', '2025-06-16 21:25:51'),
(5, 2, 70.00, 'Mpesa', '2025-06-16 21:27:08'),
(6, 2, 30.00, 'Mpesa', '2025-06-16 21:27:26'),
(7, 2, 30.00, 'Mpesa', '2025-06-16 21:28:08'),
(8, 5, 100.00, 'Cash', '2025-06-18 15:01:29'),
(9, 3, 500000.00, 'Mpesa', '2025-06-18 15:12:50'),
(10, 4, 100.00, 'Mpesa', '2025-07-07 14:17:15'),
(11, 4, 200.00, 'Cash', '2025-08-01 21:47:56'),
(12, 12, 50.00, 'Mpesa', '2025-08-01 22:07:15'),
(13, 12, 20.00, 'Cash', '2025-08-01 22:07:57'),
(14, 12, 10.00, 'Cash', '2025-08-01 22:19:10'),
(15, 13, 50.00, 'Mpesa', '2025-08-01 22:20:16');

-- --------------------------------------------------------

--
-- Table structure for table `material_supplies`
--

CREATE TABLE `material_supplies` (
  `supply_id` int(11) NOT NULL,
  `material_id` int(11) NOT NULL,
  `supplier_name` varchar(255) DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `total_cost` decimal(10,2) DEFAULT NULL,
  `supply_date` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `material_supplies`
--

INSERT INTO `material_supplies` (`supply_id`, `material_id`, `supplier_name`, `quantity`, `unit_price`, `total_cost`, `supply_date`) VALUES
(1, 3, 'Ajab', 0.00, 5000.00, 250000.00, '2025-06-16 15:34:45'),
(2, 3, 'Ajab', 0.00, 10.00, 100.00, '2025-06-16 19:42:18'),
(3, 2, 'Ajab', 29.48, 10000.00, 500000.00, '2025-06-18 14:52:28'),
(4, 4, 'Ajab', 39.34, 10.00, 500.00, '2025-06-18 14:53:10'),
(5, 3, 'Cetric', 28.98, 100.00, 200.00, '2025-06-18 15:00:45'),
(8, 2, 'Ajab', 100.00, 10.00, 1000.00, '2025-06-18 21:02:15'),
(9, 5, 'Cetric', 4980.00, 0.00, 5.00, '2025-06-18 21:34:32'),
(10, 7, 'Cetric', 40.00, 10.00, 500.00, '2025-06-19 13:48:37'),
(11, 7, 'alas', 10.00, 10.00, 100.00, '2025-07-07 14:47:29'),
(12, 2, 'Tambarine', 10.00, 10.00, 100.00, '2025-08-01 22:06:53'),
(13, 5, 'Tili', 20.00, 5.00, 100.00, '2025-08-01 22:20:01');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` int(255) NOT NULL,
  `product_number` varchar(255) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_price` decimal(10,2) NOT NULL,
  `buying_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `product_stock` int(11) NOT NULL DEFAULT 0,
  `product_description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `category_id_fk` int(255) NOT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `version` int(11) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `unit` varchar(20) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `reorder_threshold` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`product_id`, `product_number`, `product_name`, `product_price`, `buying_price`, `product_stock`, `product_description`, `created_at`, `category_id_fk`, `updated_at`, `version`, `is_deleted`, `unit`, `expiry_date`, `reorder_threshold`) VALUES
(1, '0001', 'Cement', 780.00, 0.00, 10, 'Pure cement', '2025-02-27 10:39:05', 2, '2025-08-01 15:17:09', 1, 0, NULL, NULL, 0),
(2, '007', 'Nails', 50.00, 0.00, 60, 'Testing', '2025-02-27 11:44:13', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(3, '00002', 'Handles', 346.00, 0.00, 8, 'Testing', '2025-02-27 11:51:07', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(4, '00000004', 'SimbaCement', 780.00, 0.00, 10, 'Testing', '2025-02-27 12:34:23', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(5, '00002', 'Door', 4000.00, 0.00, 0, 'Testing testign', '2025-02-27 13:57:11', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(6, '00008', 'Windows', 1500.00, 0.00, 56, 'Testing', '2025-02-27 14:44:43', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(7, '000005', 'WindowPen', 1200.00, 0.00, 54, 'Why are you nto', '2025-02-27 15:05:31', 2, '2025-07-31 17:34:43', 1, 0, NULL, NULL, 0),
(8, '008999', 'Locks', 1208.00, 0.00, 24, 'Locks', '2025-02-27 18:09:06', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(9, '02222', 'Cistern', 13000.00, 0.00, 21, 'For toilets', '2025-02-27 18:39:59', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(10, '018990', 'Doors', 5000.00, 0.00, 10, 'Doors', '2025-02-27 18:48:22', 2, '2025-07-10 14:46:33', 1, 0, NULL, NULL, 0),
(11, '0000567', 'CurtainRod', 15000.00, 0.00, 0, 'For houses', '2025-02-27 19:49:27', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(12, '000008988', 'LionCement', 1500.00, 0.00, 84, 'Sijuiss', '2025-02-27 20:15:58', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(13, '00088956', 'Cushion', 5200.00, 0.00, 9, 'N/a', '2025-03-03 18:04:41', 2, '2025-06-18 17:41:43', 1, 0, NULL, NULL, 0),
(14, '34567', 'Dirisha', 3000.00, 0.00, 0, 'Made to last', '2025-03-17 12:22:43', 18, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(15, '0008975', 'Tile', 400.00, 0.00, 0, 'For floors', '2025-03-28 09:18:02', 2, '2025-05-21 15:06:50', 1, 0, NULL, NULL, 0),
(16, '10234577689', 'Handle', 2000.00, 0.00, 18, 'This is specifically for doors', '2025-05-14 08:49:33', 18, '2025-07-07 13:52:11', 1, 0, NULL, NULL, 0),
(17, '00001345', 'Meza', 15000.00, 0.00, 0, 'A well designed table', '2025-05-21 13:45:07', 36, '2025-05-21 16:45:29', 1, 0, NULL, NULL, 0),
(18, '0000345678', 'Vest', 500.00, 0.00, 0, 'It\'s a turkey design', '2025-05-28 04:57:42', 38, '2025-05-28 08:08:12', 1, 0, NULL, NULL, 0),
(19, '0000345678', 'T-shirt', 500.00, 0.00, 45, '', '2025-05-28 04:58:54', 38, '2025-05-28 10:43:05', 1, 0, NULL, NULL, 0),
(20, '00025467', 'Curtain', 500.00, 0.00, 0, 'It\'s a type of clothe', '2025-05-28 05:09:16', 38, '2025-05-28 08:09:16', 1, 0, NULL, NULL, 0),
(21, '0000045578', 'cup', 50.00, 0.00, 47, 'It\'s just a cup', '2025-05-28 07:56:28', 40, '2025-06-24 17:12:57', 1, 0, NULL, NULL, 0),
(22, '0077896345687', 'Mandazi', 40.00, 0.00, 31, 'It\'s a mandazi', '2025-06-16 06:27:32', 2, '2025-06-19 17:43:58', 1, 0, 'kg', '2025-06-16', 0),
(23, '007789634568', 'soup', 30.00, 0.00, 5, 'It\'s just a soup', '2025-06-16 10:15:43', 40, '2025-06-25 16:45:16', 1, 0, 'pcs', '2025-06-19', 0),
(24, '0077896345689098', 'peanut soup', 30.00, 20.00, 994, 'it\'s a soup', '2025-06-16 10:28:17', 38, '2025-06-24 14:26:51', 1, 0, 'pcs', '2025-06-20', 0),
(25, '0077896345687', 'chinese soup', 20.00, 10.00, 2, 'It is a chinese soup', '2025-06-19 10:12:47', 38, '2025-06-25 14:56:59', 1, 0, 'miligram', '2025-06-19', 0),
(26, '0077896345687', 'juice', 50.00, 40.00, 0, 'It is a juice', '2025-06-19 12:13:42', 40, '2025-07-07 13:38:42', 1, 0, 'litres', '2025-06-19', 0),
(27, 'Chicken001', 'Chicken', 600.00, 500.00, 0, 'It\'s a chicken', '2025-06-23 17:51:41', 41, '2025-06-23 22:37:59', 1, 0, 'kgs', '2025-06-23', 0),
(28, '0077896345689098', 'toyotaSeat', 6000.00, 5001.00, 6, 'it\'s toyota', '2025-07-07 10:35:58', 44, '2025-07-10 17:41:59', 1, 0, 'pcs', '2025-07-07', 0),
(29, '0077896345689098', 'Mirrorbike', 6000.00, 5000.00, 31, 'it\'s a bike', '2025-07-07 14:15:46', 47, '2025-08-01 22:49:19', 1, 0, 'pcs', '2025-07-07', 0),
(30, '0077896345687', 'Dera', 500.00, 400.00, 8, 'It\'s a dress', '2025-07-10 17:43:37', 38, '2025-07-30 17:23:54', 1, 0, 'pcs', '2025-07-10', 0),
(31, '0077896345687', 'Bag', 500.00, 400.00, 16, 'It\'s bag', '2025-07-10 18:22:27', 38, '2025-07-31 17:56:14', 1, 0, 'pcs', '2025-07-10', 4);

-- --------------------------------------------------------

--
-- Table structure for table `product_recipes`
--

CREATE TABLE `product_recipes` (
  `recipe_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `material_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_recipes`
--

INSERT INTO `product_recipes` (`recipe_id`, `product_id`, `material_id`, `quantity`) VALUES
(9, 24, 2, 0.02),
(10, 24, 3, 0.02),
(19, 23, 2, 1.00),
(20, 23, 3, 1.00),
(41, 22, 3, 0.00),
(42, 22, 4, 0.00),
(43, 22, 5, 0.00),
(52, 26, 5, 10.00),
(55, 25, 5, 1.00),
(56, 27, 2, 0.00),
(57, 27, 5, 0.00),
(58, 27, 7, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `raw_materials`
--

CREATE TABLE `raw_materials` (
  `material_id` int(11) NOT NULL,
  `material_name` varchar(100) NOT NULL,
  `unit` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `raw_materials`
--

INSERT INTO `raw_materials` (`material_id`, `material_name`, `unit`) VALUES
(2, 'Oils', 'litres'),
(3, 'flour', 'grams'),
(4, 'salt', 'grams'),
(5, 'sugar', 'grams'),
(7, 'tomato', 'gram'),
(9, 'Fuel', 'litre'),
(10, 'Diesel', 'litres');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `sale_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `payment_type` enum('Cash','Mpesa') NOT NULL,
  `sale_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `vat` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `status` varchar(20) DEFAULT NULL,
  `order_number` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`sale_id`, `customer_id`, `total_price`, `payment_type`, `sale_date`, `vat`, `discount`, `status`, `order_number`) VALUES
(16, NULL, 1208.00, 'Mpesa', '2025-03-19 13:52:14', 0.00, 0.00, 'completed', NULL),
(17, NULL, 13000.00, 'Mpesa', '2025-03-19 13:58:14', 0.00, 0.00, 'completed', NULL),
(18, NULL, 13248.00, 'Cash', '2025-03-19 15:26:24', 0.00, 0.00, 'completed', NULL),
(19, NULL, 12000.00, 'Cash', '2025-03-19 15:47:08', 0.00, 0.00, 'voided', NULL),
(20, 24, 21000.00, 'Mpesa', '2025-03-19 15:50:27', 0.00, 0.00, 'completed', NULL),
(28, 23, 20000.00, 'Mpesa', '2025-03-19 15:53:13', 0.00, 0.00, 'completed', NULL),
(29, NULL, 6000.00, 'Mpesa', '2025-03-19 16:06:39', 0.00, 0.00, 'completed', NULL),
(30, NULL, 8580.00, 'Mpesa', '2025-03-19 16:09:03', 0.00, 0.00, 'voided', NULL),
(31, 26, 1208.00, 'Mpesa', '2025-03-19 16:11:16', 0.00, 0.00, 'completed', NULL),
(32, 28, 13000.00, 'Mpesa', '2025-03-21 09:40:46', 0.00, 0.00, 'voided', NULL),
(33, 28, 3624.00, 'Mpesa', '2025-03-21 10:03:31', 0.00, 0.00, 'completed', NULL),
(34, 26, 31353.28, 'Cash', '2025-03-21 10:26:02', 4353.28, 208.00, 'completed', NULL),
(35, 29, 2793.28, 'Mpesa', '2025-03-21 11:08:10', 385.28, 0.00, 'refunded', NULL),
(36, 30, 1220.00, 'Cash', '2025-03-21 15:29:00', 120.00, 100.00, 'completed', NULL),
(37, 29, 1440.00, 'Mpesa', '2025-03-24 09:51:46', 240.00, 0.00, 'voided', NULL),
(38, 29, 1301.28, 'Mpesa', '2025-03-28 08:13:17', 193.28, 100.00, 'completed', NULL),
(39, 28, 1690.00, 'Cash', '2025-03-28 08:15:06', 240.00, 50.00, 'completed', NULL),
(40, 30, 1292.00, 'Mpesa', '2025-03-28 08:16:57', 192.00, 100.00, 'voided', NULL),
(41, 28, 1349.60, 'Mpesa', '2025-03-28 08:33:13', 241.60, 100.00, 'voided', NULL),
(42, 31, 15428.80, 'Cash', '2025-05-07 10:16:09', 1420.80, 200.00, 'completed', NULL),
(43, 33, 14580.60, 'Mpesa', '2025-05-07 11:20:01', 1334.60, 100.00, 'completed', NULL),
(44, 37, 416.00, 'Mpesa', '2025-05-07 13:50:22', 0.00, 2000.00, 'refunded', NULL),
(45, 36, 26000.00, 'Mpesa', '2025-05-07 13:52:33', 0.00, 0.00, 'refunded', NULL),
(46, 37, 15598.80, 'Cash', '2025-05-07 13:54:43', 1690.80, 3000.00, 'refunded', NULL),
(47, 42, 13600.00, 'Mpesa', '2025-05-14 11:36:27', 2600.00, 2000.00, 'refunded', NULL),
(48, 40, 15080.00, 'Mpesa', '2025-05-14 15:38:15', 2080.00, 0.00, 'completed', NULL),
(49, 42, 15080.00, 'Mpesa', '2025-05-16 18:01:37', 2080.00, 0.00, 'completed', NULL),
(50, 41, 13030.00, 'Mpesa', '2025-05-16 18:19:34', 130.00, 100.00, 'completed', NULL),
(51, 36, 15080.00, 'Mpesa', '2025-05-19 13:53:24', 2080.00, 0.00, 'completed', NULL),
(53, 40, 7407.76, 'Mpesa', '2025-05-19 15:15:00', 1021.76, 0.00, 'completed', NULL),
(54, 31, 28561.28, 'Cash', '2025-05-20 10:36:27', 4353.28, 3000.00, 'completed', NULL),
(56, 40, 740.00, 'Mpesa', '2025-05-20 14:08:59', 240.00, 1000.00, 'completed', NULL),
(57, 28, 29649.60, 'Mpesa', '2025-05-20 16:19:09', 5441.60, 3000.00, 'completed', NULL),
(58, 31, 400.00, 'Mpesa', '2025-05-28 05:14:22', 0.00, 100.00, 'completed', NULL),
(59, 43, 1800.00, 'Cash', '2025-05-28 07:43:05', 0.00, 200.00, 'completed', NULL),
(60, 44, 6032.00, 'Mpesa', '2025-05-28 08:10:11', 832.00, 0.00, 'completed', NULL),
(61, 43, 5600.00, 'Cash', '2025-05-28 08:29:23', 800.00, 200.00, 'completed', NULL),
(65, 43, 46.40, 'Mpesa', '2025-06-18 11:53:47', 6.40, 0.00, 'completed', NULL),
(66, 44, 139.20, 'Mpesa', '2025-06-18 11:57:18', 19.20, 0.00, 'completed', NULL),
(67, 44, -60.80, 'Cash', '2025-06-18 12:03:26', 19.20, 200.00, 'completed', NULL),
(68, 43, 6148.00, 'Mpesa', '2025-06-18 13:48:45', 848.00, 0.00, 'completed', NULL),
(69, 44, 46.40, 'Mpesa', '2025-06-18 14:17:44', 6.40, 0.00, 'completed', NULL),
(70, 44, 34.80, 'Mpesa', '2025-06-23 16:17:01', 4.80, 0.00, 'refunded', NULL),
(71, 44, 34.80, 'Mpesa', '2025-06-23 17:19:08', 4.80, 0.00, 'completed', NULL),
(72, 44, 22.80, 'Mpesa', '2025-06-23 17:21:12', 4.80, 12.00, 'completed', NULL),
(73, 42, 3.20, 'Cash', '2025-06-23 20:22:15', 3.20, 20.00, 'completed', NULL),
(75, 44, 3.20, 'Cash', '2025-06-24 07:10:32', 3.20, 20.00, 'completed', NULL),
(76, 44, 23.20, 'Mpesa', '2025-06-24 07:32:33', 3.20, 0.00, 'completed', NULL),
(77, 42, 11.20, 'Mpesa', '2025-06-24 10:53:07', 3.20, 12.00, 'completed', '254277'),
(78, 31, 46.00, 'Mpesa', '2025-06-24 11:20:10', 6.00, 20.00, 'completed', 'ORD239'),
(79, 41, 56.00, 'Cash', '2025-06-24 11:26:51', 6.00, 10.00, 'completed', 'ORD266'),
(80, 35, 12.00, 'Cash', '2025-06-24 11:30:01', 2.00, 10.00, 'completed', 'ORD902'),
(81, 43, 47.00, 'Mpesa', '2025-06-24 11:32:00', 8.00, 1.00, 'completed', 'ORD986974'),
(82, 37, 48.00, 'Mpesa', '2025-06-24 14:12:57', 8.00, 10.00, 'completed', 'ORD591660'),
(83, 30, 13.20, 'Cash', '2025-06-24 14:42:37', 3.20, 10.00, 'completed', 'ORD781228'),
(84, 44, 94.40, 'Cash', '2025-06-25 11:13:21', 14.40, 10.00, 'completed', 'ORD419593'),
(85, 44, 48.00, 'Mpesa', '2025-06-25 11:42:21', 8.00, 10.00, 'voided', 'ORD633352'),
(86, 44, 69.60, 'Cash', '2025-06-25 13:45:16', 9.60, 0.00, 'completed', 'ORD850557'),
(87, 40, 13820.00, 'Cash', '2025-07-07 10:54:49', 1920.00, 100.00, 'completed', 'ORD143626'),
(88, 45, 6000.00, 'Cash', '2025-07-07 10:56:55', 0.00, 0.00, 'completed', 'ORD491493'),
(89, 47, 11900.00, 'Mpesa', '2025-07-07 14:22:04', 0.00, 100.00, 'voided', 'ORD226722'),
(90, 47, 13720.00, 'Cash', '2025-07-07 14:31:28', 1920.00, 200.00, 'refunded', 'ORD753441'),
(91, 46, 6960.00, 'Cash', '2025-07-10 14:41:59', 960.00, 0.00, 'completed', 'ORD356568'),
(92, 48, 380.00, 'Cash', '2025-07-10 17:58:56', 80.00, 200.00, 'completed', 'ORD873534'),
(93, 49, 950.00, 'Mpesa', '2025-07-10 18:26:58', 0.00, 50.00, 'completed', 'ORD221965'),
(94, 49, 490.00, 'Cash', '2025-07-10 18:35:36', 80.00, 90.00, 'completed', 'ORD017613'),
(95, 49, 580.00, 'Mpesa', '2025-07-30 14:21:54', 80.00, 0.00, 'completed', 'ORD510434'),
(96, 48, 570.00, 'Mpesa', '2025-07-30 14:22:44', 80.00, 10.00, 'completed', 'ORD095826'),
(97, 49, 580.00, 'Mpesa', '2025-07-30 15:38:22', 80.00, 0.00, 'refunded', 'ORD729217'),
(98, 48, 13920.00, 'Cash', '2025-08-01 19:49:19', 1920.00, 0.00, 'completed', 'ORD988060');

-- --------------------------------------------------------

--
-- Table structure for table `sales_items`
--

CREATE TABLE `sales_items` (
  `sale_item_id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS (`quantity` * `price`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales_items`
--

INSERT INTO `sales_items` (`sale_item_id`, `sale_id`, `product_id`, `quantity`, `price`) VALUES
(1, 16, 8, 1, 0.00),
(2, 17, 9, 1, 0.00),
(3, 18, 8, 6, 0.00),
(4, 18, 6, 4, 0.00),
(5, 19, 5, 3, 0.00),
(6, 20, 5, 2, 0.00),
(7, 20, 9, 1, 0.00),
(8, 28, 5, 5, 0.00),
(9, 29, 6, 4, 0.00),
(10, 30, 1, 11, 0.00),
(11, 31, 8, 1, 0.00),
(12, 32, 9, 1, 0.00),
(13, 33, 8, 3, 0.00),
(14, 34, 9, 2, 0.00),
(15, 34, 8, 1, 0.00),
(16, 35, 8, 1, 0.00),
(17, 35, 7, 1, 0.00),
(18, 36, 7, 1, 0.00),
(19, 37, 7, 1, 0.00),
(20, 38, 8, 1, 0.00),
(21, 39, 6, 1, 0.00),
(22, 40, 7, 1, 0.00),
(23, 41, 8, 1, 0.00),
(24, 42, 9, 1, 0.00),
(25, 42, 8, 1, 0.00),
(26, 43, 9, 1, 0.00),
(27, 43, 3, 1, 0.00),
(28, 44, 8, 2, 0.00),
(29, 45, 9, 2, 0.00),
(30, 46, 9, 1, 0.00),
(31, 46, 8, 1, 0.00),
(32, 46, 7, 1, 0.00),
(33, 46, 6, 1, 0.00),
(34, 47, 9, 1, 0.00),
(35, 48, 9, 1, 0.00),
(36, 49, 9, 1, 0.00),
(37, 50, 9, 1, 0.00),
(38, 51, 9, 1, 0.00),
(40, 53, 8, 5, 0.00),
(41, 53, 3, 1, 0.00),
(42, 54, 9, 2, 0.00),
(43, 54, 8, 1, 0.00),
(44, 56, 12, 1, 0.00),
(45, 57, 9, 2, 0.00),
(46, 57, 8, 1, 0.00),
(47, 58, 19, 1, 0.00),
(48, 59, 19, 4, 0.00),
(49, 60, 13, 1, 0.00),
(50, 61, 10, 1, 0.00),
(53, 65, 22, 1, 0.00),
(54, 66, 22, 3, 0.00),
(55, 67, 22, 3, 0.00),
(56, 68, 21, 2, 0.00),
(57, 68, 13, 1, 0.00),
(58, 69, 22, 1, 0.00),
(59, 70, 24, 1, 0.00),
(60, 71, 24, 1, 0.00),
(61, 72, 24, 1, 0.00),
(62, 73, 25, 1, 0.00),
(63, 75, 25, 1, 0.00),
(64, 76, 25, 1, 0.00),
(65, 77, 25, 1, 0.00),
(66, 78, 24, 2, 0.00),
(67, 79, 24, 2, 0.00),
(68, 80, 25, 1, 0.00),
(69, 81, 25, 2, 0.00),
(70, 82, 21, 1, 0.00),
(71, 83, 25, 1, 0.00),
(72, 84, 23, 3, 0.00),
(73, 85, 25, 1, 0.00),
(74, 85, 23, 1, 0.00),
(75, 86, 23, 2, 0.00),
(76, 87, 28, 2, 0.00),
(77, 88, 28, 1, 0.00),
(78, 89, 29, 2, 0.00),
(79, 90, 29, 2, 0.00),
(80, 91, 28, 1, 0.00),
(81, 92, 30, 1, 0.00),
(82, 93, 31, 2, 0.00),
(83, 94, 31, 1, 0.00),
(84, 95, 31, 1, 0.00),
(85, 96, 30, 1, 0.00),
(86, 97, 31, 1, 0.00),
(87, 98, 29, 2, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `supplier_id` int(11) NOT NULL,
  `supplier_name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`supplier_id`, `supplier_name`, `contact_person`, `phone_number`, `email`, `address`, `created_at`) VALUES
(5, 'Simba Cements', 'Michael Oduor', '0789567846', 'michael@gmail.com', 'Kiserian', '2025-03-04 14:09:50'),
(6, 'Lion Cement', 'Samuel mureithi', '0789345678', 'samuel@gmail.com', 'Mombasa', '2025-03-04 14:12:34'),
(24, 'Crown Company', 'Samuel Mureithi', '0789345678', 'test@gmail.com', 'Kiserian', '2025-03-04 14:35:08'),
(29, 'Peakers Design', 'Cetric Samuel Omwembe', '0700391535', 'scetric@gmail.com', 'Kiserian', '2025-03-04 15:25:37'),
(30, 'Queers', 'Caleb Muli', '0789345678', 'caleb@gmail.com', 'Kiserian', '2025-03-11 07:44:03'),
(31, 'Safaricom', 'David Gaiteru', '0789345678', 'david@gmail.com', 'Kiserian', '2025-03-11 11:22:16'),
(32, 'kenplastic', 'eric Omondi', '790567844', 'ericomondi@gmail.com', 'Kiserian', '2025-05-28 07:57:49'),
(33, 'Ajab', 'John Mwangi', '0745678908', 'mwangi@gmail.com', 'Kiserian', '2025-06-16 11:54:36'),
(35, 'Ajabubu', 'Muriuki', '0700456789', 'muriuki@gmail.com', 'Nanyuki', '2025-06-17 07:25:27'),
(36, 'Cetric', 'Samuel', '0789345678', 'samuel@gmail.com', 'Kiserian', '2025-06-17 08:42:17'),
(37, 'toyota', 'Michael', '0734567890', 'michael@gmail.com', 'isinyas', '2025-07-07 10:44:17'),
(39, 'ToyotaIsiolo', 'Cyrus', '0789567879', 'cyrus@gmail.com', 'isiolo', '2025-07-07 14:18:10'),
(40, 'LindaMama', 'Mama Oduor', '0789456786', 'mama@gmail.vom', 'Kiserian', '2025-07-07 17:52:21'),
(100001, 'Bata', 'Bata Person', '0789567834', 'bata@gmail.com', 'Kiserian', '2025-07-10 11:44:46'),
(100002, 'Royco', 'Marvel', '0748329429', 'marvel@gmail.com', 'Soykimau', '2025-07-31 13:57:48');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_payments`
--

CREATE TABLE `supplier_payments` (
  `payment_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_product_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `payment_method` enum('Cash','Bank Transfer','Cheque','Mpesa') NOT NULL,
  `reference` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `supplier_payments`
--

INSERT INTO `supplier_payments` (`payment_id`, `supplier_id`, `supplier_product_id`, `amount`, `payment_date`, `payment_method`, `reference`) VALUES
(1, 6, NULL, 1500.00, '2025-03-10 16:58:59', '', 'TGER567HGFV'),
(2, 6, 3, 1500.00, '2025-03-10 17:18:30', 'Cash', NULL),
(3, 6, 3, 1500.00, '2025-03-10 17:20:22', '', 'TGRD340THGS'),
(4, 6, 3, 2000.00, '2025-03-10 17:25:39', '', 'TGFRE456YHJ'),
(5, 6, 3, 2000.00, '2025-03-10 17:26:15', 'Cash', NULL),
(6, 6, 3, 3500.00, '2025-03-10 17:38:59', '', 'TGHGT567YHT'),
(7, 6, 3, 56786.00, '2025-03-10 17:39:58', 'Cash', NULL),
(8, 6, 4, 5678.00, '2025-03-10 17:42:08', '', 'tghbr56yhj'),
(9, 6, 3, 1345.00, '2025-03-10 18:07:33', '', 'TGDFR4567YJ'),
(10, 6, 3, 1345.00, '2025-03-10 18:08:03', 'Cash', ''),
(11, 6, 3, 1500.00, '2025-03-10 18:17:03', '', 'TGFBRHT567'),
(12, 6, 3, 1500.00, '2025-03-10 18:40:58', '', 'TGFREN567'),
(13, 6, 3, 1234.00, '2025-03-10 18:45:43', 'Cash', ''),
(14, 6, 3, 2240.00, '2025-03-10 18:47:38', '', 'TGFEG56GH'),
(15, 6, 3, 3456.00, '2025-03-10 18:49:08', 'Cash', 'THGERJHT56'),
(16, 6, 3, 3456.00, '2025-03-10 18:52:52', 'Mpesa', 'TGFREDFGJ76'),
(17, 6, 3, 1500.00, '2025-03-10 19:03:50', 'Mpesa', 'TGFERTY67'),
(18, 6, 1, 1.00, '2025-03-10 19:04:30', 'Cash', ''),
(19, 6, 1, 1.00, '2025-03-10 19:04:40', 'Cash', ''),
(20, 6, 7, 4.00, '2025-03-10 19:04:53', 'Cash', ''),
(21, 6, 7, 7.00, '2025-03-10 19:05:08', 'Cash', ''),
(22, 6, 2, 500.00, '2025-03-10 19:09:08', 'Cash', ''),
(23, 6, 3, 4567.00, '2025-03-10 19:09:43', 'Cash', ''),
(24, 6, 5, 45600.00, '2025-03-10 19:11:51', 'Cash', ''),
(25, 6, 2, 400.00, '2025-03-10 19:12:20', 'Mpesa', 'TGGRTHFGB56'),
(26, 6, 9, 14000.00, '2025-03-10 20:51:13', 'Cash', ''),
(27, 5, 11, 1000.00, '2025-03-10 20:55:37', 'Cash', ''),
(28, 29, 13, 56900.00, '2025-03-10 20:58:04', 'Cash', ''),
(29, 24, 14, 5000.00, '2025-03-11 05:53:12', 'Cash', ''),
(30, 24, 14, 5000.00, '2025-03-11 05:53:35', 'Mpesa', 'TGF34THGJT5'),
(31, 6, 4, 5000.00, '2025-03-11 07:07:50', 'Cash', ''),
(32, 6, 2, 5.00, '2025-03-11 07:13:14', 'Cash', ''),
(33, 5, 11, 500.00, '2025-03-11 07:14:10', 'Cash', ''),
(34, 30, 15, 5000.00, '2025-03-11 07:44:46', 'Mpesa', 'TGERHGJJ67J'),
(35, 24, 12, 456000.00, '2025-03-11 09:41:44', 'Cash', ''),
(36, 5, 10, 20.00, '2025-03-11 10:02:19', 'Cash', ''),
(37, 6, 4, 23.00, '2025-03-11 10:57:48', 'Cash', ''),
(38, 24, 14, 500.00, '2025-03-11 11:12:24', 'Cash', ''),
(39, 6, 3, 5.00, '2025-03-11 12:05:04', 'Cash', ''),
(40, 6, 2, 5.00, '2025-03-11 12:05:15', 'Cash', ''),
(41, 6, 3, 200.00, '2025-03-11 16:10:21', 'Cash', ''),
(42, 6, 3, 6.00, '2025-03-11 17:15:38', 'Cash', ''),
(43, 6, 3, 500.00, '2025-03-21 15:40:47', 'Cash', ''),
(44, 24, 12, 500.00, '2025-03-28 10:13:28', 'Cash', ''),
(45, 6, 3, 4000.00, '2025-05-20 12:41:38', 'Cash', ''),
(46, 6, 1, 1000.00, '2025-05-20 14:46:52', 'Cash', ''),
(47, 6, 9, 1000.00, '2025-05-20 16:08:08', 'Cash', ''),
(48, 32, 19, 1000.00, '2025-05-28 07:59:44', 'Cash', ''),
(49, 32, 19, 500.00, '2025-05-28 08:35:16', 'Cash', ''),
(50, 5, 23, 500.00, '2025-06-18 14:30:29', 'Cash', ''),
(51, 5, 27, 50.00, '2025-06-19 11:10:01', 'Cash', ''),
(52, 5, 24, 50.00, '2025-06-19 11:23:58', 'Mpesa', 'jfhdksdhdehrty'),
(53, 5, 23, 10.00, '2025-06-19 11:29:31', 'Mpesa', 'jhddldndj44'),
(54, 5, 11, 20.00, '2025-06-23 15:18:54', 'Cash', ''),
(55, 5, 11, 100.00, '2025-06-25 17:58:46', 'Mpesa', '10kkkjhhgg'),
(56, 5, 11, 10.00, '2025-06-25 18:01:46', 'Cash', ''),
(57, 5, 10, 10.00, '2025-06-25 18:13:42', 'Cash', ''),
(58, 37, 30, 1000.00, '2025-07-07 10:50:29', 'Cash', ''),
(59, 37, 31, 100.00, '2025-07-07 10:51:39', 'Mpesa', 'ghtyuos456'),
(60, 5, 11, 100.00, '2025-07-07 13:22:18', 'Mpesa', 'ghtjddwd345'),
(61, 39, 32, 10000.00, '2025-07-07 14:19:46', 'Cash', ''),
(62, 5, 33, 500.00, '2025-07-07 18:28:03', 'Cash', ''),
(63, 100001, 34, 1000.00, '2025-07-10 11:46:57', 'Cash', ''),
(64, 5, 35, 2000.00, '2025-07-10 17:58:12', 'Cash', ''),
(65, 100001, 36, 2000.00, '2025-07-10 18:24:29', 'Cash', ''),
(66, 5, 10, 1.00, '2025-07-31 14:00:30', 'Mpesa', 'ghjkt567'),
(67, 100002, 37, 200.00, '2025-07-31 15:26:58', 'Cash', '');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_products`
--

CREATE TABLE `supplier_products` (
  `supplier_product_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock_supplied` int(11) NOT NULL,
  `supply_date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `supplier_products`
--

INSERT INTO `supplier_products` (`supplier_product_id`, `supplier_id`, `product_id`, `price`, `stock_supplied`, `supply_date`) VALUES
(1, 6, 1, 2.00, 2, '2025-03-04 21:00:00'),
(2, 6, 1, 500.00, 10, '2025-03-05 21:00:00'),
(3, 6, 12, 150000.00, 100, '2025-03-06 21:00:00'),
(4, 6, 10, 1000.00, 11, '2025-03-06 21:00:00'),
(5, 6, 11, 50000.00, 10, '2025-03-07 21:00:00'),
(6, 6, 7, 10.00, 14, '2025-03-06 21:00:00'),
(7, 6, 9, 10.00, 4, '2025-03-06 21:00:00'),
(8, 24, 12, 589.00, 10, '2025-03-06 21:00:00'),
(9, 6, 1, 15000.00, 30, '2025-03-06 21:00:00'),
(10, 5, 13, 30.00, 10, '2025-03-06 21:00:00'),
(11, 5, 1, 1500.00, 11, '2025-03-06 21:00:00'),
(12, 24, 9, 565678.00, 40, '2025-03-06 21:00:00'),
(13, 29, 2, 56900.00, 50, '2025-03-10 21:00:00'),
(14, 24, 6, 50000.00, 56, '2025-03-10 21:00:00'),
(15, 30, 8, 5699.00, 50, '2025-03-10 21:00:00'),
(16, 30, 7, 30.00, 51, '2025-03-10 21:00:00'),
(17, 5, 13, 15000.00, 11, '2025-05-06 21:00:00'),
(18, 24, 19, 20000.00, 50, '2025-05-27 21:00:00'),
(19, 32, 21, 2000.00, 50, '2025-05-27 21:00:00'),
(20, 5, 22, 300.00, 10, '2025-06-16 21:00:00'),
(21, 5, 22, 500.00, 9, '2025-06-17 21:00:00'),
(22, 5, 22, 500.00, 10, '2025-06-17 21:00:00'),
(23, 5, 23, 1000.00, 10, '2025-06-18 21:00:00'),
(24, 5, 22, 100.00, 10, '2025-06-17 21:00:00'),
(25, 5, 22, 20.00, 0, '2025-06-18 21:00:00'),
(26, 5, 25, 10.00, 0, '2025-06-18 21:00:00'),
(27, 5, 25, 50.00, 10, '2025-06-18 21:00:00'),
(28, 5, 24, 50.00, 1, '2025-06-18 21:00:00'),
(29, 5, 24, 10000.00, 1000, '2025-06-18 21:00:00'),
(30, 37, 28, 200000.00, 10, '2025-07-06 21:00:00'),
(31, 37, 16, 2000.00, 18, '2025-07-05 21:00:00'),
(32, 39, 29, 50000.00, 10, '2025-07-06 21:00:00'),
(33, 5, 29, 1000.00, 23, '2025-07-06 21:00:00'),
(34, 100001, 10, 2000.00, 10, '2025-07-09 21:00:00'),
(35, 5, 30, 4000.00, 10, '2025-07-09 21:00:00'),
(36, 100001, 31, 4000.00, 10, '2025-07-09 21:00:00'),
(37, 100002, 31, 200.00, 10, '2025-07-30 21:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `user_password` varchar(255) NOT NULL,
  `company` varchar(255) DEFAULT NULL,
  `company_phone` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `user_email`, `user_password`, `company`, `company_phone`) VALUES
(1, 'peakers', 'scetric@gmail.com', 'fcf7bb6d546cfb82d2e55486984ae7a1862a666acb441e0cf8b4ed34a4fcf9d7', 'Peakers Design', '0700391535');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `unique_category` (`category_name`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`);

--
-- Indexes for table `material_payments`
--
ALTER TABLE `material_payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `supply_id` (`supply_id`);

--
-- Indexes for table `material_supplies`
--
ALTER TABLE `material_supplies`
  ADD PRIMARY KEY (`supply_id`),
  ADD KEY `material_id` (`material_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`);

--
-- Indexes for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD PRIMARY KEY (`recipe_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `material_id` (`material_id`);

--
-- Indexes for table `raw_materials`
--
ALTER TABLE `raw_materials`
  ADD PRIMARY KEY (`material_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`sale_id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `sales_items`
--
ALTER TABLE `sales_items`
  ADD PRIMARY KEY (`sale_item_id`),
  ADD KEY `sale_id` (`sale_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`supplier_id`),
  ADD UNIQUE KEY `unique_supplier_name` (`supplier_name`);

--
-- Indexes for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `supplier_id` (`supplier_id`),
  ADD KEY `supplier_product_id` (`supplier_product_id`);

--
-- Indexes for table `supplier_products`
--
ALTER TABLE `supplier_products`
  ADD PRIMARY KEY (`supplier_product_id`),
  ADD KEY `supplier_id` (`supplier_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `material_payments`
--
ALTER TABLE `material_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `material_supplies`
--
ALTER TABLE `material_supplies`
  MODIFY `supply_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `product_recipes`
--
ALTER TABLE `product_recipes`
  MODIFY `recipe_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT for table `raw_materials`
--
ALTER TABLE `raw_materials`
  MODIFY `material_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `sale_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=99;

--
-- AUTO_INCREMENT for table `sales_items`
--
ALTER TABLE `sales_items`
  MODIFY `sale_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=88;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `supplier_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100003;

--
-- AUTO_INCREMENT for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- AUTO_INCREMENT for table `supplier_products`
--
ALTER TABLE `supplier_products`
  MODIFY `supplier_product_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `material_payments`
--
ALTER TABLE `material_payments`
  ADD CONSTRAINT `material_payments_ibfk_1` FOREIGN KEY (`supply_id`) REFERENCES `material_supplies` (`supply_id`);

--
-- Constraints for table `material_supplies`
--
ALTER TABLE `material_supplies`
  ADD CONSTRAINT `material_supplies_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`material_id`);

--
-- Constraints for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD CONSTRAINT `product_recipes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  ADD CONSTRAINT `product_recipes_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`material_id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE SET NULL;

--
-- Constraints for table `sales_items`
--
ALTER TABLE `sales_items`
  ADD CONSTRAINT `sales_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`sale_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;

--
-- Constraints for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `supplier_payments_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `supplier_payments_ibfk_2` FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_products` (`supplier_product_id`) ON DELETE CASCADE;

--
-- Constraints for table `supplier_products`
--
ALTER TABLE `supplier_products`
  ADD CONSTRAINT `supplier_products_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `supplier_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
