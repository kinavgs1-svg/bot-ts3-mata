import ts3, time, os
print("Iniciando BOT...")
TS_HOST = os.getenv("TS_HOST")
TS_USER = os.getenv("TS_QUERY_USER")
TS_PASS = os.getenv("TS_QUERY_PASS")
GATILHO = os.getenv("POKE_GATILHO", "mata")

with ts3.query.TS3Connection(TS_HOST, 10011) as c:
    c.login(client_login_name=TS_USER, client_login_password=TS_PASS)
    c.use(sid=1)
    c.clientupdate(client_nickname="BOT Mata-Mata")
    print("BOT ONLINE!")
    last = {}
    while True:
        for e in c.keepalive():
            if "notifytextmessage" in e:
                msg = e.get('msg','').lower()
                nick = e.get('invokername','')
                if GATILHO in msg:
                    print(f"Poke de {nick}: {msg}")
                    for cl in c.clientlist():
                        if cl['client_nickname'] == nick:
                            if cl['clid'] not in last or time.time()-last[cl['clid']]>60:
                                c.clientpoke(clid=cl['clid'], msg="VAI TER MATA-MATA EM 2 MIN! BORA TS!")
                                last[cl['clid']] = time.time()
        time.sleep(0.2)
