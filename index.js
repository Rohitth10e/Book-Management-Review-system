import express, { response } from "express";
import pg from "pg";
import axios from "axios";
import session from "express-session";

const app = new express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Project-1",
  password: "2223",
  port: 5433,
});

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

db.connect((err) => {
  if (err) {
    console.log(err.message);
  } else {
    console.log("Connected to db");
  }
});

const userId = [{}];

app.use(
  session({
    secret: "secretkey", // Replace with a secure random string
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

function isAuthenticated(req, res, next){
  if (req.session.username) {
    next();
  } else {
    res.redirect("/login"); // Redirect to login if not authenticated
  }
}

async function getRomCom() {
  let response = await axios.get(
    `https://openlibrary.org/search.json?q=romance&limit=4`
  );
  return response.data;
}

async function getMystery() {
  let response = await axios.get(
    `https://openlibrary.org/search.json?q=mystery&limit=4`
  );
  return response.data;
}

async function getRecents(req) {
  const userIdResult = await db.query(
    "SELECT id FROM users WHERE username = $1",
    [req.session.username]
  );
  const userId = userIdResult.rows[0]?.id;
  let response = await db.query(
    "SELECT b.book_id, b.title, b.author_name, r.created_at ,b.book_cover, r.rating, r.notes " +
      "FROM books b " +
      "JOIN reviews r ON b.book_id = r.book_id " +
      "WHERE b.user_id = $1 " +
      "ORDER BY r.created_at DESC LIMIT 3",
    [userId]
  );
  return response.rows;
}

async function checkReview(req,book_id,user_id){
  const exists=db.query('Select * from reviews where book_id=$1 and user_id=$2',[book_id,user_id]);

  if(exists){
    return false;
  }else{
    return true;
  }
}

async function addBook(book_id, book_name, author_name, book_cover, user_id) {
  try {
    const existingBook = await db.query(
      `SELECT * FROM books WHERE book_id = $1 AND user_id = $2`,
      [book_id, user_id.id]
    );

    if (existingBook.rows.length > 0) {
      console.log("Book already exists for this user.");
      return { success: false, error: "Duplicate book" };
    }

    await db.query(
      `INSERT INTO books (book_id, title, author_name, book_cover, user_id) VALUES ($1, $2, $3, $4, $5)`,
      [book_id, book_name, author_name, book_cover, user_id.id]
    );

    console.log("Inserted into the table books");
    return { success: true };
  } catch (err) {
    console.error("Error inserting book:", err.message);
    return { success: false, error: err.message };
  }
}


// async function addBook(book_id, book_name, author_name, book_cover, user_id) {
//   try {
//     await db.query(
//       `INSERT INTO books (book_id, title, author_name, book_cover, user_id) VALUES ($1, $2, $3, $4, $5)`,
//       [book_id, book_name, author_name, book_cover, user_id.id]
//     );
//     console.log("Inserted into the table books");
//     return { success: true };
//   } catch (err) {
//     console.error("Error inserting book:", err.message);
//     return { success: false, error: err.message };
//   }
// }

app.get("/", isAuthenticated, async (req, res) => {
  const searchQuery = req.query.bookname;
  const username = req.session.username || "Guest";
  console.log(req.session);
  try {
    let response = null;
    let romCom = await getRomCom();
    let myst = await getMystery();
    let recents = await getRecents(req);

    // If search query exists, fetch search results and render the result page
    if (searchQuery) {
      response = (
        await axios.get(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(
            searchQuery
          )}&limit=10`
        )
      ).data;

      return res.render("result", {
        books: response.docs,
        searchQuery: searchQuery,
        username: username,
      });
    } else if (searchQuery === "") {
      return res.render("index", {
        username: username,
        message: "Please enter a search query to search",
        romance: romCom.docs,
        mystery: myst.docs,
        recents: recents || null,
      });
    } else {
      return res.render("index", {
        username: username,
        romance: romCom.docs,
        mystery: myst.docs,
        recents: recents || null, // Pass recents to view, handle no recents
      });
    }
  } catch (err) {
    console.error("Error fetching books:", err.message);
    return res.render("index", { error: err.message });
  }
});

app.post("/addBook", async (req, res) => {
  const { book_id, book_name, author_name, book_cover } = req.body;
  console.log(req.session.username);
  const idRes = await (
    await db.query("Select id from users where username=$1", [
      req.session.username,
    ])
  ).rows[0];
  console.log(idRes);

  const result = await addBook(
    book_id,
    book_name,
    author_name,
    book_cover,
    idRes
  );

  if (result.success) {
    res.redirect("/");
  } else {
    console.error("Error inserting book");
    res.redirect("/");
  }
});

{
  /* <input type="hidden" name="book_id" value="<%= book.isbn[0] %>"> */
}

// app.get("/write", async (req, res) => {
//   const { book_id, book_name, author_name, book_cover } = req.body;
//   console.log(req.session.username);
//   const idRes = await (
//     await db.query("Select id from users where username=$1", [
//       req.session.username,
//     ])
//   ).rows[0];
//   console.log(idRes);

//   const result = await addBook(
//     book_id,
//     book_name,
//     author_name,
//     book_cover,
//     idRes
//   );

//   if (result.success) {
//     res.render("write", {
//       title: book_name,
//       author: author_name,
//       cover: book_cover,
//     });
//   } else {
//     res.redirect("/");
//   }
// });

app.post("/write", async (req, res) => {
  let { book_id, book_name, author_name, book_cover } = req.body;
  console.log(req.session.username);
  const idRes = await (
    await db.query("Select id from users where username=$1", [
      req.session.username,
    ])
  ).rows[0];
  console.log(idRes);

  book_id = book_id || "book-" + new Date().getTime();

  const result = await addBook(
    book_id,
    book_name,
    author_name,
    book_cover,
    idRes
  );

  if (result.success) {
    res.render("write", {
      title: book_name,
      author: author_name,
      cover: book_cover,
    });
  } else {
    res.redirect("/");
  }
});

app.post("/review", async (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const review = req.body.review;
  const rating = req.body.rating;

  const book_id = (
    await db.query("Select book_id from books where title=$1", [title])
  ).rows[0];
  console.log(book_id);
  const idRes = await (
    await db.query("Select id from users where username=$1", [
      req.session.username,
    ])
  ).rows[0];
  console.log(idRes);
  try {
    await db.query(
      "Insert into reviews (user_id,book_id,rating,notes) values($1,$2,$3,$4)",
      [idRes.id, book_id.book_id, rating, review]
    );
    res.redirect("/");
  } catch (err) {
    console.log("Error:", err.message);
    res.redirect("/");
  }
});

app.get("/getNotes", async (req, res) => {
  const idRes = await (
    await db.query("Select id from users where username=$1", [
      req.session.username,
    ])
  ).rows[0];
  console.log(idRes);
  try {
    const notes = await db.query(
      "Select books.book_id,books.title,books.author_name,books.book_cover,reviews.rating,reviews.notes,reviews.created_at from reviews join books on books.book_id=reviews.book_id and books.user_id=reviews.user_id where books.user_id=$1",
      [idRes.id]
    );
    console.log(notes.rows);
    res.render("getNotes", { Notes: notes.rows });
  } catch (err) {
    console.log("Error: ", err.message);
    res.render("getNotes");
  }
});

app.post("/sort", async (req, res) => {
  try {
    // Get the user ID based on the session's username
    const idRes = await db.query("SELECT id FROM users WHERE username=$1", [
      req.session.username,
    ]);
    const userId = idRes.rows[0]?.id;

    if (!userId) {
      console.log("User not found.");
      return res.redirect("/login"); 
    }

    
    let orderBy = "";
    switch (req.body.sortby) {
      case "ltoh":
        orderBy = "ORDER BY reviews.rating ASC";
        break;
      case "htol":
        orderBy = "ORDER BY reviews.rating DESC";
        break;
      case "created_at":
        orderBy = "ORDER BY reviews.created_at DESC";
        break;
      default:
        console.log("Invalid sorting option.");
        return res.redirect("/getNotes"); 
    }

    const notes = await db.query(
      `SELECT books.book_id, books.title, books.author_name, books.book_cover, 
              reviews.rating, reviews.notes, reviews.created_at 
       FROM reviews 
       JOIN books ON books.book_id = reviews.book_id AND books.user_id = reviews.user_id 
       WHERE books.user_id = $1 ${orderBy}`,
      [userId]
    );
    res.render("getNotes", { Notes: notes.rows });
  } catch (err) {
    console.error("Error:", err.message);
    res.redirect("/getNotes"); // Redirect in case of any error
  }
});


app.post("/register", async (req, res) => {
  const username = req.body.username;
  const email = req.body.email;
  const phone = req.body.phone;
  const password = req.body.password;
  await db.query(
    "Insert into users (username,email,password) values($1,$2,$3)",
    [username, email, password]
  );

  res.render("login");
});

async function checkUser(username, password) {
  // let flag=false;
  const res = (
    await db.query("Select username,password from users where username=$1", [
      username,
    ])
  ).rows[0];
  console.log(res);
  if (res.password == password) {
    return true;
  } else {
    return false;
  }
}

app.get("/bookmark", async (req, res) => {
  const idRes = await (
    await db.query("Select id from users where username=$1", [
      req.session.username,
    ])
  ).rows[0];

  try {
    const result = await db.query("Select * from books where user_id=$1", [
      idRes.id,
    ]);
    console.log(result.rows);
    res.render("bookmark", { books: result.rows });
  } catch (err) {
    console.log("Error: ", err.message);
    res.redirect("/");
  }
});

app.post("/editpost", async (req, res) => {
  const book_id = req.body.book_id;
  const idRes = await db.query("SELECT id FROM users WHERE username=$1", [
    req.session.username,
  ]);
  const userId = idRes.rows[0].id;

  console.log(book_id);

  try {
    const result = await db.query(
      "SELECT books.book_id,books.title, books.author_name, books.book_cover, notes, rating,created_at FROM reviews JOIN books ON books.book_id = reviews.book_id WHERE reviews.book_id = $1 AND reviews.user_id = $2",
      [book_id, userId]
    );

    if (result.rows.length > 0) {
      res.render("editPost", { editPost: result.rows[0] });
    } else {
      res.render("editPost", { error: "No review found for this book." });
    }
  } catch (err) {
    console.log("Error: ", err.message);
    res.render("editPost", { error: err.message });
  }
});

app.post("/editedpost", async (req, res) => {
  const { book_id, review, rating } = req.body;
  console.log(req.body);

  try {
    const userIdResult = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [req.session.username]
    );
    const userId = userIdResult.rows[0]?.id;

    if (!userId) {
      console.log("User ID not found");
      return res.redirect("/");
    }

    console.log("User id from editedPost post method:", userId);

    const existingReview = await db.query(
      "SELECT * FROM reviews WHERE book_id = $1 AND user_id = $2",
      [book_id, userId]
    );

    console.log("Existing review:", existingReview.rows);

    if (existingReview.rows.length === 0) {
      console.log("No existing review found for this user and book.");
      return res.redirect("/");
    }

    const result = await db.query(
      "UPDATE reviews SET notes = $1, rating = $2 WHERE user_id = $3 AND book_id = $4",
      [review, rating, userId, book_id]
    );

    console.log("Updated rows:", result.rowCount);
    res.redirect("/");
  } catch (err) {
    console.error("Error during update:", err.message);
    res.redirect("/");
  }
});

app.post("/deletepost", async (req, res) => {
  const book_id = req.body.book_id;
  console.log("Deleted: ", book_id);

  try {
    const userIdResult = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [req.session.username]
    );
    const userId = userIdResult.rows[0]?.id;

    if (!userId) {
      console.log("User ID not found");
      return res.redirect("/");
    }

    await db.query("DELETE FROM reviews WHERE user_id=($1) AND book_id=($2)", [
      userId,
      book_id,
    ]);

    res.redirect("/");
  } catch (err) {
    console.log("Error: ", err.message);
    res.redirect("/");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const isValid = await checkUser(username, password);

  if(username==="" || password===""){
    res.render("login",{message:"Please enter valid username & password to proceed"})
  }

  if (isValid) {
    req.session.username = username; // Set the session variable
    res.redirect("/");
  } else {
    res.render("login", { error: "Invalid username or password" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/"); // Handle error if necessary
    }
    res.redirect("/login"); // Redirect to login page after logging out
  });
});

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
