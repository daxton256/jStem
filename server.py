from flask import Flask, render_template, request, send_file, make_response, jsonify, redirect
from dotenv import load_dotenv
import make_stem
import mariadb, hashlib, jwt, time, secrets, os

app = Flask(__name__)

load_dotenv()

conn = mariadb.connect(
        user=os.getenv("mariadb_user"),
        password=os.getenv("mariadb_password"),
        host=os.getenv("mariadb_host"),
        port=3306,
        database=os.getenv("mariadb_database")

    )

conn.auto_reconnect = True 

jwt_secret = secrets.token_hex(32)

def genAT(username: str, length: int = 604800):
    exp_time = int(time.time()) + length
    encoded_jwt = jwt.encode({"username": username, "exp": exp_time}, jwt_secret, algorithm="HS256")
    return encoded_jwt

def checkValidation(token: str):
    try:
        if not token:
            raise

        validated_jwt = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        print("vaild", validated_jwt)
        return True, validated_jwt
    except Exception as e:
        print("invalid", e)
        return False, None
    

@app.route("/home")
def home():
    existing_auth = request.cookies.get("access_token")
    print(existing_auth)
    if not existing_auth or not checkValidation(existing_auth)[0]:
        return redirect("/login")

    return render_template("home.html")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login")
def login():
    existing_auth = request.cookies.get("access_token")
    if existing_auth and checkValidation(existing_auth)[0]:
        return redirect("/home")
    
    return render_template("login.html")

@app.route("/signup")
def signup():
    existing_auth = request.cookies.get("access_token")
    if existing_auth and checkValidation(existing_auth)[0]:
        return redirect("/home")

    return render_template("signup.html")

@app.route("/api/login", methods=["POST"])
def api_login():
    

    username = request.form.get("username")
    password = request.form.get("password")
    if(len(username) == 0 or len(password) == 0):
        return "Username and password cannot be empty."
 
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE username=?", (username,))

    result = cursor.fetchone()
    if result is None:
        return "User does not exist."
    
    stored_password = result[0]
    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    if stored_password != hashed_password:
        return "Incorrect password."
    
    cursor.close()

    access_token = genAT(username)

    resp = make_response(redirect("/home")) 
    resp.set_cookie('access_token', access_token)
    return resp

@app.route("/api/signup", methods=["POST"])
def api_signup():
    
    username = request.form.get("username")
    password = request.form.get("password")

    if(len(username) == 0 or len(password) == 0):
        return "Username and password cannot be empty."
    
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users WHERE username=?", (username,))

    result = cursor.fetchone()
    if result is not None:
        return "Username already exists."
    

    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    cursor.execute("INSERT INTO users (username, passsword) VALUES (?, ?)", (username, hashed_password))

    conn.commit()
    cursor.close()

    access_token = genAT(username)

    resp = make_response(redirect("/home")) 
    resp.set_cookie('access_token', access_token)
    return resp

@app.route("/api/userstems")
def userstems():
    existing_auth = request.cookies.get("access_token")
    validtoken, user = checkValidation(existing_auth)
    if validtoken:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM stems WHERE owner = ?", (user["username"],))

        stems = cursor.fetchall()

        cursor.close()

        stemJSON = []
        for stem in stems:
            json = {"id": stem[0], "owner": stem[1], "data": stem[2]}
            stemJSON.append(json)

        return jsonify(stemJSON)
    
    return jsonify([]), 401 
    

@app.route("/api/createstem")
def createstem():
    existing_auth = request.cookies.get("access_token")
    validtoken, user = checkValidation(existing_auth)
    if validtoken:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO stems (Owner, json_data) VALUES (?, ?)", (user["username"], ""))
        stemID = cursor.lastrowid
        conn.commit()
        cursor.close()

        return jsonify({"id": stemID})
    
    return jsonify([]), 401

@app.route("/api/editstem", methods=["POST"])
def editstem():
    stemInfo = request.json
    if(stemInfo and stemInfo["content"] is not None and stemInfo["id"]):
        existing_auth = request.cookies.get("access_token")
        validtoken, user = checkValidation(existing_auth)
        if validtoken:
            cursor = conn.cursor()
            cursor.execute("UPDATE stems SET json_data= ? WHERE ID = ?", (stemInfo["content"], stemInfo["id"]))
            conn.commit()
            cursor.close()
            return jsonify([])
        
        return jsonify([]), 401
    
    return jsonify([]), 406

#@app.route("/api/deletestem", methods=["POST"])
#def deletestem():
    


@app.route("/stem", methods=["GET"])
def get_stems():
    search_query = request.args.get("query")
    song_path, title, art = make_stem.from_soundcloud(make_stem.soundcloud_search(search_query))
    return {"path": song_path, "bass": f"{song_path}/bass.wav", "drums": f"{song_path}/drums.wav", "other": f"{song_path}/other.wav", "vocals": f"{song_path}/vocals.wav", "title": title, "artwork_url": art}

@app.route("/songs/<id>/<file>", methods=["GET"])
def serve_sound(id, file):
    return send_file(f"songs/{id}/{file}")

if __name__ == "__main__":
    app.run(debug=True)