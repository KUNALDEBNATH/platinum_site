import psycopg2
import sys
try:
    conn = psycopg2.connect(dbname='sales_db', user='postgres', password='292957', host='localhost', port=5432)
    print('connected')
    cur = conn.cursor()
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public';")
    rows = cur.fetchall()
    print('tables_count:', len(rows))
    if rows:
        print('sample_tables:', rows[:5])
    conn.close()
except Exception as e:
    print('error_type:', type(e).__name__)
    print('error:', e)
    sys.exit(1)
