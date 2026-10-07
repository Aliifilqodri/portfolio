const { MongoClient, ObjectId } = require('mongodb');
let p;

function local() {
  const fs = require('fs'), path = require('path');
  const dir = path.join(process.cwd(), '.localdb');
  fs.mkdirSync(dir, { recursive: true });
  const file = n => path.join(dir, n + '.json');
  const read = n => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return {}; } };
  const write = (n, d) => fs.writeFileSync(file(n), JSON.stringify(d));
  return {
    collection: n => ({
      async findOne(q) {
        const d = read(n)[String(q._id)];
        if (!d) return null;
        return d.data64 ? { ...d, data: { buffer: Buffer.from(d.data64, 'base64') } } : d;
      },
      async updateOne(q, u) {
        const all = read(n), k = String(q._id);
        all[k] = { ...(all[k] || { _id: q._id }), ...u.$set };
        write(n, all);
        return {};
      },
      async insertOne(doc) {
        const all = read(n), id = new ObjectId();
        const { data, ...rest } = doc;
        all[String(id)] = { ...rest, _id: String(id), data64: data.toString('base64') };
        write(n, all);
        return { insertedId: id };
      }
    })
  };
}

function db() {
  if (!process.env.MONGODB_URI) return Promise.resolve(local());
  if (!p) p = new MongoClient(process.env.MONGODB_URI).connect();
  return p.then(c => c.db(process.env.MONGODB_DB || 'portfolio'));
}
module.exports = { db, ObjectId };
