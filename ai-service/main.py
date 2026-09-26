from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def home():
    return{
        "message": "AI Career Copilot AI service is running!"

    } 
