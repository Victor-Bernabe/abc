const { MongoClient, ObjectId } = require('mongodb');
const http = require('http');
const { parse } = require('querystring');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const qs = require('qs');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000; // process.env.PORT for Cyclic
const TTDB = 'two-thousand-db';
const SLDB = 'simple-list-db';
const KIDB = 'kanji-inspector-db';
const ORIGINS = [
  'https://simple-list.victorbp.site',
  'https://2048.victorbp.site',
  'https://kanji-inspector.victorbp.site',
];

if (process.env.LOCALHOST) {
  ORIGINS.push(process.env.LOCALHOST);
}

const server = http.createServer((req, res) => {
  let index = ORIGINS.indexOf(req.headers.origin); // Check if comes from my subdomains
  res.setHeader('Content-Type', 'application/json'); // Returned data is JSON
  res.setHeader('Access-Control-Allow-Origin', `${index > -1 ? ORIGINS[index] : 'none.none'}`);
  res.setHeader('Vary', 'Origin'); // Should be like this when Access-Control-Allow-Origin != *

  // Only use POST method
  if (req.method === 'POST') {
    let params = ''; // To store params sent with POST request
    req.on('data', chunk => {
      params += chunk.toString(); // Convert Buffer to string
    });
    req.on('end', () => {
      main(parse(params))
        .then(data => {
          res.statusCode = 200;
          res.end(JSON.stringify(data));
        })
        .catch(error => {
          res.statusCode = 500;
          res.end(JSON.stringify(error));
        });
    });
  } else {
    res.statusCode = 405; // Method Not Allowed
    res.end(JSON.stringify({ error: 405 }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});

// Connect to MongoDB, query and return data
async function main(params) {
  const uri = process.env.MONGODB;
  const client = new MongoClient(uri, { useUnifiedTopology: true });

  try {
    await client.connect();
    let data = {}; // Returned data to the user

    // Make the appropriate DB calls
    switch (params.todo) {
      case 'saveKanji':
        {
          data = await saveKanji(client, JSON.parse(params.kanji));
        }
        break;
      case 'getScores':
        {
          data = await getScores(client);
        }
        break;
      case 'setScore':
        {
          data = await setScore(client, params.nick, params.score);
        }
        break;
      case 'login':
        {
          data = await login(client, params.email, params.password);
        }
        break;
      case 'doesUserNeedToken':
        {
          data = await doesUserNeedToken(client, params.email, params.token);
        }
        break;
      case 'getList':
        {
          data = await getList(client, params.listId);
        }
        break;
      case 'getLists':
        {
          data = await getLists(client, params.email, params.token);
        }
        break;
      case 'addList':
        {
          data = await addList(client, params.title, params.email);
        }
        break;
      case 'addItem':
        {
          data = await addItem(client, params.listId, params.title, params.itemId, params.amount, params.price);
        }
        break;
      case 'itemChanged':
        {
          data = await itemChanged(client, params.listId, params.itemId, params.completed);
        }
        break;
      case 'removeList':
        {
          data = await removeList(client, params.listId);
        }
        break;
      case 'shareList':
        {
          data = await shareList(client, params.listId, params.borrowerEmail);
        }
        break;
      case 'removeItem':
        {
          data = await removeItem(client, params.listId, params.itemId);
        }
        break;
      case 'renameList':
        {
          data = await renameList(client, params.listId, params.title);
        }
        break;
      case 'renameItem':
        {
          data = await renameItem(client, params.listId, params.itemId, params.title, params.amount);
        }
        break;
      case 'editMessage':
        {
          data = await editMessage(client, params.listId, params.itemId, params.message);
        }
        break;
      case 'leaveList':
        {
          data = await leaveList(client, params.listId, params.email);
        }
        break;
      case 'deleteAccount':
        {
          data = await deleteAccount(client, params.email, params.token);
        }
        break;
      case 'register':
        {
          data = await register(client, params.email, params.password);
        }
        break;
      case 'sortBy':
        {
          data = await sortBy(client, params.listId, params.sortBy);
        }
        break;
      case 'reorderItems':
        {
          data = await reorderItems(client, params.listId, JSON.parse(params.positions));
        }
        break;
      case 'setDate':
        {
          data = await setDate(client, params.listId, params.itemId, params.date);
        }
        break;
      case 'setPrice':
        {
          data = await setPrice(client, params.listId, params.itemId, params.price);
        }
        break;
      case 'addLink':
        {
          data = await addLink(client, params.listId, params.itemId, params.link);
        }
        break;
      case 'setCategory':
        {
          data = await setCategory(client, params.listId, params.itemId, params.category);
        }
        break;
      case 'removeDate':
        {
          data = await removeDate(client, params.listId, params.itemId);
        }
        break;
      case 'removeLink':
        {
          data = await removeLink(client, params.listId, params.itemId);
        }
        break;
      case 'deleteCompleted':
        {
          data = await deleteCompleted(client, params.listId);
        }
        break;
      case 'isAdmin':
        {
          data = await isAdmin(client, params.email, params.token);
        }
        break;
      case 'addContactMessage':
        {
          data = await addContactMessage(client, params.email, params.message);
        }
        break;
      case 'getContactMessages':
        {
          data = await getContactMessages(client);
        }
        break;
      case 'deleteContactMessage':
        {
          data = await deleteContactMessage(client, params.id);
        }
        break;
      case 'verifyCaptcha':
        {
          data = await verifyCaptcha(params.token);
        }
        break;
      default:
        break;
    }
    return data;
  } catch (e) {
    return { error: e.toString() };
  } finally {
    await client.close();
  }
}

// Get all scores for 2048 in descending order
async function getScores(client) {
  const scores = await client.db(TTDB).collection('scores').find().sort({ score: -1 }).limit(10).toArray();
  return scores;
}

// Save one score for 2048
async function setScore(client, nick, score) {
  const result = await client
    .db(TTDB)
    .collection('scores')
    .insertOne({
      nick,
      score: +score,
    });
  return result;
}

// Login (Simple List)
async function login(client, email, password) {
  let result = {};

  // Get user from MongoDB
  const user = await client.db(SLDB).collection('users').findOne({ email: email });

  const exist = await bcrypt.compare(password, user.password);

  // Check if user exists
  if (exist) {
    const newToken = uuidv4();
    result.user_exists = true;
    // Add token to DB
    await client
      .db(SLDB)
      .collection('users')
      .updateOne(
        { email: email },
        {
          $set: {
            token: newToken,
          },
        },
      );
    result.token = newToken;
    result.email = email;
    return result;
  } else {
    result.user_exists = false;
    return result;
  }
}

// If user needs a new token for the session (Simple List)
async function doesUserNeedToken(client, email, token) {
  let result = {};

  // Get user from MongoDB
  const user = await client.db(SLDB).collection('users').findOne({ email: email });

  const needsToken = token !== user.token;

  if (needsToken) {
    result.needs = true;
  } else {
    result.needs = false;
  }

  return result;
}

// Return a list
async function getList(client, listId) {
  const list = await client
    .db(SLDB)
    .collection('lists')
    .findOne({ _id: ObjectId(listId) });

  // Sort items if needed
  if (list !== null) {
    // Found list
    if (list.items.length > 0) {
      switch (list.sortBy) {
        case 'title':
          {
            list.items.sort((a, b) => a.title.localeCompare(b.title));
          }
          break;
        case 'custom':
          {
            list.items.sort((a, b) => a.position - b.position);
          }
          break;
        case 'date':
          {
            list.items.sort((a, b) => a.date.localeCompare(b.date));
          }
          break;
        default:
          {
          }
          break;
      }
    } else {
      // List has no items, nothing to sort
    }
  } else {
    // List not found
    return [];
  }

  return list;
}

// Get lists for an user (included shared lists)
async function getLists(client, email, token) {
  // Check user being the one doing the call
  const { needs } = await doesUserNeedToken(client, email, token);

  if (needs) {
    return [];
  } else {
    // Get lists from MongoDB (alphabetically)
    const lists = await client
      .db(SLDB)
      .collection('lists')
      .find({ viewers: email })
      .project({ _id: 1, title: 1 })
      .sort({ title: 1 })
      .toArray();

    return lists;
  }
}

// Add list to DB
async function addList(client, title, email) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .insertOne({
      owner: email,
      viewers: [email],
      sortBy: 'none',
      title: title,
      items: [],
    });

  return result;
}

// Add item to DB
async function addItem(client, listId, title, itemId, amount, price) {
  const newItem = {
    id: itemId,
    title: title,
    completed: false,
    date: '',
    position: 0,
    link: '',
    category: '',
    message: '',
    amount: Number(amount),
    price: Number(price),
  };

  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne(
      { _id: ObjectId(listId) },
      {
        $push: { items: newItem },
      },
    );

  return result;
}

// Set item as completed or uncompleted
async function itemChanged(client, listId, itemId, completed) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.completed': completed === 'true' } });

  return result;
}

// Removing a list also removes all items inside
async function removeList(client, listId) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .deleteOne({ _id: ObjectId(listId) });

  return result;
}

// Add user as viwer of a list
async function shareList(client, listId, borrowerEmail) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId) }, { $addToSet: { viewers: borrowerEmail } });

  return result;
}

// Remove item from list
async function removeItem(client, listId, itemId) {
  try {
    await client
      .db(SLDB)
      .collection('lists')
      .updateOne({ _id: ObjectId(listId) }, { $pull: { items: { id: itemId } } });

    return {};
  } catch (err) {
    console.error(err);
    return {};
  }
}

// Rename list
async function renameList(client, listId, title) {
  await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId) }, { $set: { title: title } });

  return title;
}

// Rename item
async function renameItem(client, listId, itemId, title, amount) {
  try {
    await client
      .db(SLDB)
      .collection('lists')
      .updateOne(
        { _id: ObjectId(listId), 'items.id': itemId },
        { $set: { 'items.$.title': title, 'items.$.amount': Number(amount) } },
      );
    return {};
  } catch (err) {
    return { error: err.toString() };
  }
}

// Edit message
async function editMessage(client, listId, itemId, message) {
  try {
    await client
      .db(SLDB)
      .collection('lists')
      .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.message': message } });
    return {};
  } catch (err) {
    return { error: err.toString() };
  }
}

// User leaves a list someone has shared with him/her
async function leaveList(client, listId, email) {
  try {
    await client
      .db(SLDB)
      .collection('lists')
      .updateOne({ _id: ObjectId(listId) }, { $pull: { viewers: email } });

    return {};
  } catch (err) {
    console.error(err);
    return {};
  }
}

// Delete user account (lists not included)
async function deleteAccount(client, email, token) {
  let result = {};
  try {
    await client.db(SLDB).collection('users').deleteOne({ email: email, token: token });
    return result;
  } catch (error) {
    return result;
  }
}

// Check if request comes from admin (victorbp)
async function isAdmin(client, email, token) {
  let response = { admin: false };

  // Check if user exists
  let userExists = (await client.db(SLDB).collection('users').find({ email: email, token: token }).count()) > 0;

  if (userExists && email === process.env.EMAIL) {
    response.admin = true;
  } else {
    response.admin = false;
  }

  return response;
}

// Register an user
async function register(client, email, password) {
  // Return codes
  // 0 -> Registered
  // 1 -> User already exist
  let response = { code: 0 }; // Default, registered

  // Check if user already exists
  let userExists = (await client.db(SLDB).collection('users').find({ email: email }).count()) > 0;

  if (userExists) {
    response.code = 1; // User already exists
    return response;
  } else {
    // User doesn't exists
    response.code = 0;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Add user to DB
    await client.db(SLDB).collection('users').insertOne({
      email: email,
      password: hashedPassword,
      token: uuidv4(),
    });

    return response;
  }
}

// Update list sort type
async function sortBy(client, listId, sortType) {
  const result = client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId) }, { $set: { sortBy: sortType } });

  return result;
}

// Reorder items in a list with custom positions
async function reorderItems(client, listId, positions) {
  // Seems like mongodb 3.6 allows this in one request.
  // I will keep it compatible for now, with the idea
  // to change it in the future
  for (let i = 0; i < positions.length; i++) {
    await client
      .db(SLDB)
      .collection('lists')
      .updateOne(
        { _id: ObjectId(listId), 'items.id': positions[i].id },
        { $set: { 'items.$.position': positions[i].position } },
        { upsert: true },
      );
  }
  return {};
}

// Set or update item date
async function setDate(client, listId, itemId, date) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.date': date } });

  return result;
}

// Set or update item price
async function setPrice(client, listId, itemId, price) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.price': Number(price) } });

  return result;
}

// Add (set) a link for an item
async function addLink(client, listId, itemId, link) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.link': link } });

  return result;
}

// Add (set) a category (just a color) for an item
async function setCategory(client, listId, itemId, color) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.category': color } });

  return result;
}

// Set item date to empty string
async function removeDate(client, listId, itemId) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.date': '' } });

  return result;
}

// Set item link to empty string
async function removeLink(client, listId, itemId) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId), 'items.id': itemId }, { $set: { 'items.$.link': '' } });

  return result;
}

// Remove all items in a list that are checked
async function deleteCompleted(client, listId) {
  const result = await client
    .db(SLDB)
    .collection('lists')
    .updateOne({ _id: ObjectId(listId) }, { $pull: { items: { completed: true } } });

  return result;
}

// Save one kanji for kanji-inspector
async function saveKanji(client, kanji) {
  const result = await client
    .db(KIDB)
    .collection('kanjis')
    .updateOne({ kanji: kanji.kanji }, { $setOnInsert: kanji }, { upsert: true });

  return result;
}

async function addContactMessage(client, email, message) {
  const result = await client.db(SLDB).collection('messages').insertOne({
    email: email,
    message: message,
  });

  return result;
}

// Get contact messages
async function getContactMessages(client) {
  // Get lists from MongoDB (alphabetically)
  const messages = await client.db(SLDB).collection('messages').find({}).toArray();

  return messages;
}

// Delete contact messages
async function deleteContactMessage(client, id) {
  const result = await client
    .db(SLDB)
    .collection('messages')
    .deleteOne({ _id: ObjectId(id) });

  return result;
}

async function verifyCaptcha(token) {
  const data = qs.stringify({
    secret: process.env.CAPTCHA,
    response: token,
  });

  const config = {
    method: 'post',
    url: 'https://www.google.com/recaptcha/api/siteverify',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: data,
  };

  const result = await axios(config);

  return result.data;
}