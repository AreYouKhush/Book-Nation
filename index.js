import express from "express";
import axios from "axios";
import pg from "pg";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const db = new pg.Client({
    host: process.env.HOST,
    user: process.env.USER,
    database: process.env.DB,
    password: process.env.PASSWORD,
    port: 5432,
    ssl: true
})

const app = express();
const port = process.env.PORT || 3000;

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

async function getUserName(userId){
    const response = await db.query("SELECT firstname FROM users WHERE id = $1", [userId]);
    const firstname = response.rows[0].firstname;
    return firstname;
}

async function checkIfInLibrary(userId, bookId){
    let message;
    const checkIfInLibrary = await db.query('SELECT * FROM my_library WHERE id = $1 AND book_id = $2', [userId, bookId]);
    if(checkIfInLibrary.rows.length){
        message = "✅ ADDED";
    }
    return message;
}

function checkIfLoggedIn(){
    let status;
    if("Logged in"){
        return 1;
    }else{
        return 0;
    }
}

app.get('/', async(req, res) => {
    let userId;
    let firstname;
    let status = 0;
    if(req.cookies.id){
        userId = req.cookies.id;
        firstname = await getUserName(userId);
        status = 1;
    }
    const title = "Winnie the pooh";
    const books = await getBooks(title);
    res.render("index.ejs", {
        status: status,
        books: books,
        name: firstname
    })
})

app.post('/', async(req, res) => {
    let userId;
    let firstname;
    let status = 0;
    if(req.cookies.id){
        userId = req.cookies.id;
        firstname = await getUserName(userId);
        status = 1;
    }
    const title = req.body.searchTitle;
    const books = await getBooks(title);
    res.render("index.ejs", {
        status: status,
        books: books,
        name: firstname
    })
})

app.get('/works/:id', async (req, res) => {
    const bookId = req.params.id;
    let noteResponse;
    let userId;
    let status = 0;
    if(req.cookies.id){
        userId = Number(req.cookies.id);
        noteResponse = await db.query("SELECT uid, note_title, note FROM notes WHERE id = $1 AND book_id = $2", [userId, bookId]);
        noteResponse = noteResponse.rows;
        status = 1
    }
    const book = await getSpecificBook(bookId);
    const message = await checkIfInLibrary(userId, bookId);
    // console.log(noteResponse.rows);
    res.render("notes.ejs", {
        status: status,
        book: book,
        message: message,
        savedNote: noteResponse
    });
})

app.get('/works/:id/notes', async(req, res) => {
    const bookId = req.params.id;
    const userId = Number(req.cookies.id);
    const book = await getSpecificBook(bookId);
    res.render("add-notes.ejs", {
        status: 1,
        book: book,
    });
})

app.post('/works/:id/notes/add', async(req, res) => {
    const bookId = req.params.id;
    const userId = Number(req.cookies.id);
    const noteTitle = req.body["note-title"];
    const noteContent = req.body["note"];
    if(noteTitle.trim() == "" && noteContent.trim() == ""){
        res.redirect(`/works/${bookId}`);
    }else{
        await db.query("INSERT INTO notes (id, book_id, note_title, note) VALUES ($1, $2, $3, $4)", [userId, bookId, noteTitle, noteContent]);
        res.redirect(`/works/${bookId}`);
    }
})

app.get('/works/:bid/:uid/notes/edit', async(req, res) => {
    const bookId = req.params.bid;
    const userId = Number(req.cookies.id);
    const noteId = req.params.uid;
    const response = await db.query("SELECT uid, note_title, note FROM notes WHERE uid = $1", [noteId]);
    const book = await getSpecificBook(bookId);
    res.render("edit-note.ejs", {
        status: 1,
        book: book,
        snote: response.rows[0],
        uid: noteId
    });
})

app.post('/works/:bid/:uid/notes/edit/save', async (req, res) => {
    const bookId = req.params.bid;
    const noteId = req.params.uid;
    const noteTitle = req.body["note-title"];
    const noteContent = req.body["note"];
    if(noteTitle.trim() == "" && noteContent.trim() == ""){
        res.redirect(`/works/${bookId}`);
    }else{
        await db.query("UPDATE notes SET note_title = $1, note = $2 WHERE uid = $3", [noteTitle, noteContent, noteId]);
        res.redirect(`/works/${bookId}`);
    }
})

app.post('/works/:bid/:uid/delete', async (req, res) => {
    const noteId = req.params.uid;
    const bookId = req.params.bid;
    await db.query("DELETE FROM notes WHERE uid = $1", [noteId]);
    res.redirect(`/works/${bookId}`);
})

app.get('/mylibrary', async(req, res) => {
    try{
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
            status: 1,
            user_id: userId,
            books: booksArray
        })
    }catch{
        res.redirect("/login");
    }
})

app.post('/mylibrary/add/:id', async(req, res) => {
    try{
        const userId = Number(req.cookies.id);
        const bookId = req.params.id;
        await db.query("INSERT INTO my_library (id, book_id) VALUES ($1, $2)", [userId, bookId]);
        res.redirect(`/works/${bookId}`);
    }catch (err){
        res.redirect('/login');
    }
})

app.get('/mylibrary/remove/:id', async(req, res) => {
    try{
        const userId = Number(req.cookies.id);
        try{
            const bookId = req.params.id;
            await db.query("DELETE FROM my_library WHERE id = $1 AND book_id = $2", [userId, bookId]);
            res.redirect(`/mylibrary`);
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
        res.render('login.ejs', {error: "Username or Password are incorrect!"});
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

app.get("/logout", (req, res) => {
    res.clearCookie("id");
    res.redirect("/");
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})