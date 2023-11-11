import express from "express";
import axios from "axios";
import pg from "pg";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

const db = new pg.Client({
    host: 'localhost',
    user: 'postgres',
    database: 'books',
    password: 'prouddaddy@08',
    port: 5432
})

const app = express();
const port = 3000;

db.connect();

//Middlewares
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

async function getBooks( title ){
    let books = [];
    const result = await axios.get(`https://openlibrary.org/search.json?q=${title}`);
    let authorName;
    let authorNameProperty = "author_name";
    let coverIdProperty = "cover_i";
    let coverId;
    for(let i = 0; i < result.data.docs.length; i++){
        // const coverId = result.data.docs[i]["cover_i"];
        if((result.data.docs[i]).hasOwnProperty(authorNameProperty)){
            authorName = result.data.docs[i].author_name[0]
        }else{
            authorName = "Unknown";
        }

        if((result.data.docs[i]).hasOwnProperty(coverIdProperty)){
            let c = result.data.docs[i].cover_i
            coverId = `https://covers.openlibrary.org/b/id/${c}-L.jpg`;
            // console.log({cover_id: c});
        }else{
            coverId = "images/Image Not Available.png";
        }

        books.push({
            id: result.data.docs[i].key,
            coverURL: coverId,
            title: result.data.docs[i].title,
            publishYear: result.data.docs[i].first_publish_year,
            authorName: authorName
        })
    }
    return books;
}

async function getSpecificBook(id){
    const response = await axios.get(`https://openlibrary.org/works/${id}.json`);
    const authorId = response.data.authors[0].author.key;
    const authorRes = await axios.get(`https://openlibrary.org${authorId}.json`)
    const authorName = authorRes.data.personal_name;
    let description;
    let coverURL;
    if(response.data.hasOwnProperty("description")){
        description = response.data.description.value;
    }else{
        description = "No data available";
    }

    if((response.data).hasOwnProperty("covers")){
        let c = response.data.covers[0];
        coverURL = `https://covers.openlibrary.org/b/id/${c}-L.jpg`;
    }else{
        coverURL = "/images/Image Not Available.png";
    }
    let book = {
        id: id,
        coverURL: coverURL,
        title: response.data.title,
        description: description,
        authorName: authorName,
    }
    // console.log(id);
    return book;
}

function getUserId(){
    
}

app.get('/', async(req, res) => {
    // console.log(req.cookies);
    const title = "Winnie the pooh";
    const books = await getBooks(title);
    res.render("index.ejs", {
        books: books
    })
})

app.post('/', async(req, res) => {
    const title = req.body.searchTitle;
    const books = await getBooks(title);
    res.render("index.ejs", {
        books: books
    })
})

app.get('/works/:id', async (req, res) => {
    const bookId = req.params.id;
    const userId = Number(req.cookies.id);
    const book = await getSpecificBook(bookId);
    let message;
    const checkIfInLibrary = await db.query('SELECT * FROM my_library WHERE id = $1 AND book_id = $2', [userId, bookId]);
    if(checkIfInLibrary.rows.length){
        message = "✅ ALREADY ADDED";
    }
    res.render("notes.ejs", {
        book: book,
        message: message
    });
})

app.get('/works/:id/notes', async(req, res) => {
    const bookId = req.params.id;
    const userId = Number(req.cookies.id);
    const book = await getSpecificBook(bookId);
    let message;
    const checkIfInLibrary = await db.query('SELECT * FROM my_library WHERE id = $1 AND book_id = $2', [userId, bookId]);
    if(checkIfInLibrary.rows.length){
        message = "✅ ALREADY ADDED";
    }
    res.render("edit-notes.ejs", {
        book: book,
        message: message
    });
})

app.get('/mylibrary', async(req, res) => {
    const userId = Number(req.cookies.id);
    let booksArray = []
    const response = await db.query('SELECT book_id FROM my_library WHERE id = $1', [userId]);
    const bookId = response.rows;
    // console.log(bookId);
    for(let i = 0; i < bookId.length; i++){
        const book = await getSpecificBook(bookId[i].book_id);
        booksArray.push(book);
        // console.log(booksArray);
    }
    res.render("mylibrary.ejs", {
        user_id: userId,
        books: booksArray
    })
})

app.post('/mylibrary/add/:id', async(req, res) => {
    try{
        const userId = Number(req.cookies.id);
        try{
            const bookId = req.params.id;
            await db.query("INSERT INTO my_library (id, book_id) VALUES ($1, $2)", [userId, bookId]);
            res.redirect(`/works/${bookId}`);
        }catch (err){
            console.log(err);
        }
    }catch (err){
        res.redirect('/login');
    }
})

app.get('/login', async(req, res) => {
    res.render('login.ejs');
});

app.post('/login', async(req, res) => {
    const user = req.body["username"];
    const password = req.body["password"];
    const response = await db.query("SELECT id FROM users WHERE user_name = $1 AND password = $2", [user, password]);
    if(!response.rows.length){
        res.render('login.ejs', {error: "Username or Password already exists!"});
    }else{
        const id = response.rows[0].id;
        // window.localStorage.setItem("userId", id); Local Storage does not work in noje js
        res.cookie('id', id, {maxAge: 2 * 60 * 60 * 1000, httpOnly: true});
        // getUserId();
        res.redirect(`/mylibrary`);
    }
});

app.get('/register', async(req, res) => {
    res.render('register.ejs');
});

app.post('/register', async(req, res) => {
    const fName = req.body["firstname"];
    const lName = req.body["lastname"] || null;
    const email = req.body["email"];
    const username = req.body["username"];
    const password = req.body["password"];
    // console.log({fName, lName, email, username, password});
    const response = await db.query("SELECT * FROM users WHERE user_name = $1", [username]);
    if(response.rows.length){
        res.render("register.ejs", {
            error: "Username is already taken",
        })
    }else{
        const q = await db.query("INSERT INTO users (user_name, password, email, firstname, lastname) VALUES ($1, $2, $3, $4, $5) RETURNING id", [username, password, email, fName, lName]);
        const id = q.rows[0].id;
        res.cookie('id', id, {maxAge: 2 * 60 * 60 * 1000, httpOnly: true});
        res.redirect('/');
    }
})

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
})