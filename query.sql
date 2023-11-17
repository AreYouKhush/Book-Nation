-- To Create user table
CREATE TABLE users (
	id serial primary key,
	user_name text not null unique,
	password text not null,
	email text not null,
	firstname text not null,
	lastname text
);

--Create my library table
CREATE TABLE my_library (
	uid serial,
	id int REFERENCES users(id) ON DELETE CASCADE,
	book_id text,
	primary key(id, book_id)
);

--Create notes table
CREATE TABLE notes (
	uid serial PRIMARY KEY,
	id int not null,
	book_id text not null,
	note_title text,
	note text
);

--Create comments table
CREATE TABLE comments (
	uid serial PRIMARY KEY,
	user_id int REFERENCES users(id),
	book_id text not null,
	comment text not null,
)