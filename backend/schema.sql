-- Run this first: mysql -u root -p < backend/schema.sql
CREATE DATABASE IF NOT EXISTS research_portal
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE research_portal;

CREATE TABLE IF NOT EXISTS research_opportunities (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT         NOT NULL,
  research_area         VARCHAR(150) NOT NULL,
  faculty_name          VARCHAR(150) NOT NULL,
  department            VARCHAR(150) NOT NULL,
  required_skills       VARCHAR(500) NOT NULL,
  available_positions   INT UNSIGNED NOT NULL,
  application_deadline  DATE         NOT NULL,
  status                ENUM('Open','Closed') NOT NULL DEFAULT 'Open'
);
