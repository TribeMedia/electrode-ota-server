const cassandra = require('cassandra-driver');


const loadCassandraFactory = require('.././cassandra/load-cassandra');


module.exports = function (conf = {contactPoints: ['localhost'], keyspace: 'ota'}) {
    const keyspace = conf.keyspace;
    const loadCassandra = loadCassandraFactory(keyspace);
    if (conf.username && conf.password){
        conf.authProvider = new cassandra.auth.PlainTextAuthProvider(conf.username, conf.password);
    }
    let client = new cassandra.Client(conf);


    const cp = (...args)=> new Promise((resolve, reject)=> client.execute(...args, (e, o)=> e ? reject(e) : resolve(o)));
    const order = (queries) => {
        let ret = Promise.resolve(true);
        for (const q of queries) ret = ret.then(_=>cp(q));
        ret = ret.then(()=>cp(`use ${keyspace};`));
        return ret;
    };
    const drop = ()=>new Promise((resolve, reject)=>client.execute(`drop KEYSPACE ${keyspace} ;`, (e,o)=>{
        e ? resolve() : resolve()
    }));

    const reset = ()=>new Promise((resolve, reject)=> {
        client.connect((e)=> {
            if (e) return reject(e);
            resolve();
        })
    }).then(_=>drop().then(() => order(loadCassandra)));

    const connect = (opts)=> {
        const reset = opts ? opts.reset : false;
        return new Promise((resolve, reject)=> {
            client.connect(e=> {
                if (e) {
                    if (e.code == 8704) {
                        delete conf.keyspace;
                        client = new cassandra.Client(conf);
                        if (reset) {
                            return drop().then(_=>order(loadCassandra)).then(_=>resolve(client));
                        }
                        return order(loadCassandra).then(_=>resolve(client));
                    } else {
                        console.error('Error connecting', e);
                        return reject(e);
                    }
                }
                if (reset) {
                    return drop().then(_=>order(loadCassandra)).then(_=>resolve(client))
                } else {
                    resolve(client);
                }
            });
        })
    };
    return {
        connect,
        reset,
        client,
        cp,
        order,
        drop
    }
}
;

