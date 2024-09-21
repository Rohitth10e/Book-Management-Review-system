CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT,
    password TEXT,
    email TEXT
);

CREATE TABLE books (
  book_id TEXT,
  title TEXT,
  author_name TEXT,
  book_cover TEXT,
  user_id INTEGER,
  PRIMARY KEY (book_id, user_id)
);

CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    book_id TEXT NOT NULL, -- Should be TEXT, matching the type in the books table
    rating INT CHECK (rating BETWEEN 1 AND 5), -- Assuming rating is between 1 and 5
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for review creation
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id, user_id) REFERENCES books(book_id, user_id) -- Composite foreign key
);
