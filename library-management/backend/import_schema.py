import mysql.connector

conn = mysql.connector.connect(
    host="tokaido.proxy.rlwy.net",
    port=30478,
    user="root",
    password="PNfCUKPdBGKvugiFkAOnjjeEYtEgDlWm",
)

cursor = conn.cursor()

with open("schema.sql", "r", encoding="utf-8") as f:
    sql_script = f.read()

# Split on semicolons, run each statement separately
statements = [s.strip() for s in sql_script.split(";") if s.strip()]

for stmt in statements:
    try:
        cursor.execute(stmt)
        print("OK:", stmt[:60].replace("\n", " "))
    except mysql.connector.Error as e:
        print("ERROR:", e, "in statement:", stmt[:60])

conn.commit()
cursor.close()
conn.close()
print("Done!")