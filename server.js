const path = require('path');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4173;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'daily_expenses';
const inviteCode = process.env.INVITE_CODE;
let MongoClient;
let mongoModulePromise;
let db;
const sessionCookie = 'daily_expenses_session';

const seedTransactions = [
  { id:'t1', type:'expense', amount:2100, category:'Food & Dining', subcategory:'Groceries', date:'2025-05-06', note:'Weekly groceries', includeInReal:true },
  { id:'t2', type:'expense', amount:1400, category:'Transport', subcategory:'Metro and fuel', date:'2025-05-05', note:'', includeInReal:true },
  { id:'t3', type:'expense', amount:900, category:'Shopping', subcategory:'Home supplies', date:'2025-05-03', note:'', includeInReal:true },
  { id:'t4', type:'expense', amount:1200, category:'Bills & Utilities', subcategory:'Electricity', date:'2025-05-02', note:'', includeInReal:true },
  { id:'t5', type:'expense', amount:700, category:'Entertainment', subcategory:'Streaming', date:'2025-05-01', note:'', includeInReal:true },
  { id:'t6', type:'loan', amount:1250, category:'Loans', subcategory:'Home Loan', date:'2025-05-05', note:'Monthly EMI', includeInReal:false },
  { id:'t7', type:'loan', amount:750, category:'Loans', subcategory:'Car Loan', date:'2025-05-10', note:'Monthly EMI', includeInReal:false },
  { id:'t8', type:'investment', amount:700, category:'Investments', subcategory:'SIP', date:'2025-05-05', note:'Monthly SIP', includeInReal:false }
];
const seedSchedules = [
  { id:'s1', type:'loan', amount:1250, category:'Loans', subcategory:'Home Loan', dueDay:5, frequency:'Monthly', autoAdd:true },
  { id:'s2', type:'loan', amount:750, category:'Loans', subcategory:'Car Loan', dueDay:10, frequency:'Monthly', autoAdd:true },
  { id:'s3', type:'investment', amount:700, category:'Investments', subcategory:'SIP', dueDay:15, frequency:'Monthly', autoAdd:true },
  { id:'s4', type:'investment', amount:500, category:'Investments', subcategory:'Stock', dueDay:20, frequency:'Monthly', autoAdd:true }
];
const seedCategories = [
  { id:'c1', name:'Food & Dining', kind:'expense', spendGroup:'need', active:true }, { id:'c2', name:'Transport', kind:'expense', spendGroup:'need', active:true }, { id:'c3', name:'Shopping', kind:'expense', spendGroup:'goodToHave', active:true }, { id:'c4', name:'Bills & Utilities', kind:'expense', spendGroup:'commitment', active:true }, { id:'c5', name:'Entertainment', kind:'expense', spendGroup:'leisure', active:true }, { id:'c6', name:'Health', kind:'expense', spendGroup:'growth', active:true }, { id:'c7', name:'Other', kind:'expense', spendGroup:'goodToHave', active:true }, { id:'c8', name:'Loans', kind:'loan', active:true }, { id:'c9', name:'Investments', kind:'investment', active:true }
];
const seedHabits = [
  { id:'h1', name:'Meditation', icon:'habit', color:'purple-bg', goalType:'duration', target:15, unit:'min', frequency:'Daily', startDate:'2025-05-01', milestoneType:'days', milestoneTarget:30, active:true },
  { id:'h2', name:'Reading', icon:'book', color:'amber-bg', goalType:'count', target:20, unit:'pages', frequency:'Daily', startDate:'2025-05-01', milestoneType:'total', milestoneTarget:1000, active:true },
  { id:'h3', name:'Walking', icon:'walk', color:'teal-bg', goalType:'count', target:6000, unit:'steps', frequency:'Daily', startDate:'2025-05-01', milestoneType:'total', milestoneTarget:100000, active:true },
  { id:'h4', name:'Sleep', icon:'moon', color:'blue-bg', goalType:'duration', target:7.5, unit:'hrs', frequency:'Daily', startDate:'2025-05-01', milestoneType:'days', milestoneTarget:30, active:true }
];
const defaultSettings = { monthlyExpenseBudget:60000, monthlyBudgetOverrides:{} };
const validSpendGroups = ['need','commitment','growth','goodToHave','leisure'];

app.use(express.json());
app.use(express.static(path.join(__dirname), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') }));

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
function passwordsMatch(password, user) { const hash = crypto.scryptSync(password, user.passwordSalt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex')); }
function inviteMatches(value) { if (!inviteCode) return false; const provided = Buffer.from(String(value || '')); const expected = Buffer.from(inviteCode); return provided.length === expected.length && crypto.timingSafeEqual(provided, expected); }
function normalizeMonthKey(value) {
  if (/^\d{4}-\d{2}$/.test(String(value || ''))) return String(value);
  const match = String(value || '').trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) return '';
  const monthIndex = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[1].slice(0, 3).toLowerCase());
  return monthIndex >= 0 ? `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}` : '';
}
function timeToMinutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : null;
}
function sleepHours(from, to) {
  const start = timeToMinutes(from);
  let end = timeToMinutes(to);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 10) / 10;
}
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => { const [key, ...value] = part.trim().split('='); return [key, decodeURIComponent(value.join('='))]; })); }
async function currentUser(req) { const token = cookies(req)[sessionCookie]; if (!token) return null; const session = await (await ensureDatabase()).collection('sessions').findOne({ token, expiresAt:{ $gt:new Date() } }); if (!session) return null; return db.collection('users').findOne({ id:session.userId }, { projection:{ _id:0, passwordHash:0, passwordSalt:0 } }); }
async function requireAuth(req, res, next) { try { req.user = await currentUser(req); if (!req.user) return res.status(401).json({ error:'Authentication required' }); next(); } catch (error) { res.status(500).json({ error:error.message }); } }
function setSession(res, token) { res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`); }
function defaultSpendGroup(name = '') {
  const value = String(name).toLowerCase();
  if (/loan|emi|insurance|subscription|term|bill|utility|electricity|rent/.test(value)) return 'commitment';
  if (/book|course|learn|education|health|gym|fitness|medical|doctor/.test(value)) return 'growth';
  if (/entertain|movie|restaurant|travel|leisure|game|hobby/.test(value)) return 'leisure';
  if (/shopping|auto|fuel|wallet|misc|gadget|home/.test(value)) return 'goodToHave';
  return 'need';
}
function cleanSpendGroup(value, name = '') { return validSpendGroups.includes(value) ? value : defaultSpendGroup(name); }
function buildStockPositions(trades = []) {
  const positions = {};
  const sorted = trades.slice().sort((a, b) => {
    const dateCompare = String(a.tradeDate || '').localeCompare(String(b.tradeDate || ''));
    if (dateCompare) return dateCompare;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
  for (const trade of sorted) {
    const symbol = String(trade.symbol || '').toUpperCase();
    if (!symbol) continue;
    const row = positions[symbol] || { quantityLeft:0, openCost:0 };
    const qty = Number(trade.quantity || 0);
    const price = Number(trade.price || 0);
    const fees = Number(trade.fees || 0);
    if (trade.tradeType === 'sell') {
      if (row.quantityLeft + 0.000001 < qty) return { error:`Sell quantity exceeds available ${symbol} quantity.` };
      const avg = row.quantityLeft ? row.openCost / row.quantityLeft : 0;
      row.quantityLeft = Math.max(0, row.quantityLeft - qty);
      row.openCost = Math.max(0, row.openCost - (avg * qty));
    } else {
      row.quantityLeft += qty;
      row.openCost += (qty * price) + fees;
    }
    positions[symbol] = row;
  }
  return { positions };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode: submittedInviteCode } = req.body;
    if (!email || !password || password.length < 8) return res.status(400).json({ error:'Use an email and a password with at least 8 characters.' });
    if (!name?.trim()) return res.status(400).json({ error:'Name is required.' });
    if (!inviteCode) return res.status(403).json({ error:'Registration is closed. INVITE_CODE is not configured.' });
    if (!inviteMatches(submittedInviteCode)) return res.status(403).json({ error:'Invite code is incorrect.' });

    const database = await ensureDatabase();
    const users = database.collection('users');
    const normalizedEmail = email.toLowerCase();
    const existing = await users.findOne({ email:normalizedEmail });
    if (existing) {
      if (!passwordsMatch(password, existing)) return res.status(409).json({ error:'An account with that email already exists.' });
      await ensureUserData(existing.id);
      const token = crypto.randomBytes(32).toString('hex');
      await database.collection('sessions').insertOne({ token, userId:existing.id, createdAt:new Date(), expiresAt:new Date(Date.now() + 604800000) });
      setSession(res, token);
      return res.json({ id:existing.id, email:existing.email, name:existing.name, createdAt:existing.createdAt });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date();
    const { salt, hash } = hashPassword(password);
    const cleanName = name.trim();
    await users.insertOne({ id, email:normalizedEmail, name:cleanName, passwordSalt:salt, passwordHash:hash, createdAt });
    await ensureUserData(id);
    const token = crypto.randomBytes(32).toString('hex');
    await database.collection('sessions').insertOne({ token, userId:id, createdAt:new Date(), expiresAt:new Date(Date.now() + 604800000) });
    setSession(res, token);
    res.status(201).json({ id, email:normalizedEmail, name:cleanName, createdAt });
  } catch (error) {
    res.status(500).json({ error:error.message });
  }
});
app.post('/api/auth/login', async (req, res) => { try { const database = await ensureDatabase(); const { email, password } = req.body; const user = await database.collection('users').findOne({ email:(email || '').toLowerCase() }); if (!user || !passwordsMatch(password || '', user)) return res.status(401).json({ error:'Email or password is incorrect.' }); await ensureUserData(user.id); const token = crypto.randomBytes(32).toString('hex'); await database.collection('sessions').insertOne({ token, userId:user.id, createdAt:new Date(), expiresAt:new Date(Date.now() + 604800000) }); setSession(res, token); res.json({ id:user.id, email:user.email, name:user.name, createdAt:user.createdAt }); } catch (error) { res.status(500).json({ error:error.message }); } });
app.post('/api/auth/logout', async (req, res) => { const token = cookies(req)[sessionCookie]; if (token && db) await db.collection('sessions').deleteOne({ token }); res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); res.json({ ok:true }); });
app.get('/api/auth/me', async (req, res) => { try { const user = await currentUser(req); res.json(user ? { authenticated:true, user } : { authenticated:false }); } catch (error) { res.status(500).json({ error:error.message }); } });
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error:'Name is required.' });
    const database = await ensureDatabase();
    const result = await database.collection('users').findOneAndUpdate({ id:req.user.id }, { $set:{ name } }, { returnDocument:'after', projection:{ _id:0, passwordHash:0, passwordSalt:0 } });
    res.json(result.value || result);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

async function ensureDatabase() {
  if (!mongoUri) throw new Error('MONGODB_URI is not configured');
  if (db) return db;
  if (!MongoClient) {
    mongoModulePromise ||= import('mongodb');
    MongoClient = (await mongoModulePromise).MongoClient;
  }
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);
  const transactions = db.collection('transactions'); const schedules = db.collection('schedules'); const habits = db.collection('habits'); const habitLogs = db.collection('habitLogs'); const stockTrades = db.collection('stockTrades');
  await transactions.dropIndex('id_1').catch(error => { if (error.codeName !== 'IndexNotFound') throw error; });
  await schedules.dropIndex('id_1').catch(error => { if (error.codeName !== 'IndexNotFound') throw error; });
  await transactions.createIndex({ ownerId: 1, id: 1 }, { unique: true });
  await schedules.createIndex({ ownerId: 1, id: 1 }, { unique: true });
  await habits.createIndex({ ownerId: 1, id: 1 }, { unique: true });
  await habitLogs.createIndex({ ownerId: 1, habitId: 1, date: 1 }, { unique: true });
  await stockTrades.createIndex({ ownerId: 1, id: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt:1 }, { expireAfterSeconds:0 });
  return db;
}

async function ensureUserData(userId) { const database = await ensureDatabase(); const transactions = database.collection('transactions'); const schedules = database.collection('schedules'); const categories = database.collection('categories'); const settings = database.collection('settings'); const habits = database.collection('habits'); if (!await settings.findOne({ ownerId:userId })) await settings.insertOne({ ownerId:userId, ...defaultSettings }); const hasUserTransactions = await transactions.countDocuments({ ownerId:userId }); const hasLegacy = await transactions.countDocuments({ ownerId:{ $exists:false } }); if (!hasUserTransactions && hasLegacy) { await transactions.updateMany({ ownerId:{ $exists:false } }, { $set:{ ownerId:userId } }); await schedules.updateMany({ ownerId:{ $exists:false } }, { $set:{ ownerId:userId } }); } else if (!hasUserTransactions) { await transactions.insertMany(seedTransactions.map(item => ({ ...item, ownerId:userId }))); await schedules.insertMany(seedSchedules.map(item => ({ ...item, ownerId:userId }))); } if (!await categories.countDocuments({ ownerId:userId })) await categories.insertMany(seedCategories.map(item => ({ ...item, ownerId:userId }))); const uncategorized = await categories.find({ ownerId:userId, kind:'expense', $or:[{ spendGroup:{ $exists:false } }, { spendGroup:null }, { spendGroup:{ $nin:validSpendGroups } }] }).toArray(); await Promise.all(uncategorized.map(category => categories.updateOne({ _id:category._id }, { $set:{ spendGroup:cleanSpendGroup(category.spendGroup, category.name) } }))); if (!await habits.countDocuments({ ownerId:userId })) await habits.insertMany(seedHabits.map(item => ({ ...item, ownerId:userId }))); }

function localDate(value = new Date()) { const date = value instanceof Date ? value : new Date(`${value}T00:00:00`); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addMonths(date, months) { const next = new Date(date); const day = next.getDate(); next.setDate(1); next.setMonth(next.getMonth() + months); next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); return next; }
function dueDatesForSchedule(schedule, now = new Date()) {
  const today = localDate(now); const startDate = schedule.startDate || `${today.slice(0, 8)}${String(schedule.dueDay || now.getDate()).padStart(2, '0')}`;
  if (startDate > today || (schedule.endDate && schedule.endDate < startDate)) return [];
  const start = new Date(`${startDate}T00:00:00`); const current = new Date(`${today}T00:00:00`); const frequency = schedule.frequency || 'Monthly';
  if (frequency === 'BiMonthly') {
    const days = (schedule.dueDays?.length ? schedule.dueDays : [schedule.dueDay]).map(Number).filter(day => day >= 1 && day <= 31).sort((a,b) => a - b);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    return days.map(day => localDate(new Date(current.getFullYear(), current.getMonth(), Math.min(day, lastDay))))
      .filter(dueDate => dueDate <= today && dueDate >= startDate && (!schedule.endDate || dueDate <= schedule.endDate));
  }
  let due = new Date(start);
  if (frequency === 'Daily') due = current;
  else if (frequency === 'Weekly') { const days = Math.floor((current - start) / 86400000); due.setDate(start.getDate() + Math.floor(days / 7) * 7); }
  else if (frequency === 'Quarterly') { const months = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth(); due = addMonths(start, Math.floor(months / 3) * 3); if (due > current) due = addMonths(due, -3); }
  else if (frequency === 'Yearly') { due.setFullYear(current.getFullYear()); if (due > current) due.setFullYear(due.getFullYear() - 1); }
  else { const day = Number(schedule.dueDay) || start.getDate(); due = new Date(current.getFullYear(), current.getMonth(), Math.min(day, new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate())); if (due > current) due = addMonths(due, -1); }
  const dueDate = localDate(due);
  if (dueDate < startDate || (schedule.endDate && dueDate > schedule.endDate)) return [];
  return [dueDate];
}

async function processSchedules(userId) {
  const database = await ensureDatabase(); const transactions = database.collection('transactions'); const schedules = database.collection('schedules');
  const due = await schedules.find({ ownerId:userId, autoAdd:true, archived:{ $ne:true } }).toArray();
  for (const schedule of due) {
    for (const dueDate of dueDatesForSchedule(schedule)) {
      const periodKey = dueDate; if ((schedule.skippedMonths || []).includes(periodKey)) continue;
      const exists = await transactions.findOne({ ownerId:userId, scheduleId:schedule.id, $or:[{ periodKey }, { date:dueDate }] });
      if (exists) continue;
      await transactions.insertOne({ id:`auto-${schedule.id}-${periodKey}`, ownerId:userId, scheduleId:schedule.id, periodKey, type:schedule.type, amount:schedule.amount, category:schedule.category, subcategory:schedule.subcategory, date:dueDate, note:'Auto-added from schedule', includeInReal:schedule.type === 'expense' });
    }
  }
}

app.get('/api/data', requireAuth, async (req, res) => {
  try { const database = await ensureDatabase(); await ensureUserData(req.user.id); await processSchedules(req.user.id); const [transactions, schedules, categories, settings, habits, habitLogs, stockTrades] = await Promise.all([database.collection('transactions').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray(), database.collection('schedules').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray(), database.collection('categories').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray(), database.collection('settings').findOne({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }), database.collection('habits').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray(), database.collection('habitLogs').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray(), database.collection('stockTrades').find({ ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }).toArray()]); res.json({ transactions, schedules, categories, settings:settings || defaultSettings, habits, habitLogs, stockTrades }); }
  catch (error) { res.status(500).json({ error:error.message }); }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const monthlyExpenseBudget = Number(req.body.monthlyExpenseBudget);
    const monthlyBudgetOverrides = req.body.monthlyBudgetOverrides && typeof req.body.monthlyBudgetOverrides === 'object' ? req.body.monthlyBudgetOverrides : {};
    if (!monthlyExpenseBudget || monthlyExpenseBudget < 0) return res.status(400).json({ error:'Monthly expense budget must be a positive amount.' });
    const cleanOverrides = Object.fromEntries(Object.entries(monthlyBudgetOverrides).map(([month, value]) => [normalizeMonthKey(month), Number(value)]).filter(([month, value]) => month && value > 0));
    const settings = { monthlyExpenseBudget, monthlyBudgetOverrides:cleanOverrides };
    await database.collection('settings').updateOne({ ownerId:req.user.id }, { $set:{ ownerId:req.user.id, ...settings } }, { upsert:true });
    res.json(settings);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  try { const database = await ensureDatabase(); const { transaction, recurring, frequency, dueDays, endDate, originalAmount, remainingPrincipal, annualRate, interestType, amountInvestedToDate, currentValue, investmentValuationDate, amountWithdrawn, expectedAnnualRate, projectionEndDate } = req.body; if (!transaction?.amount || !transaction?.type) return res.status(400).json({ error:'Invalid transaction' }); transaction.ownerId=req.user.id; if (recurring) { if (endDate && endDate < transaction.date) return res.status(400).json({ error:'Schedule end date must be after the transaction date.' }); const cleanDueDays = Array.isArray(dueDays) ? dueDays.map(Number).filter(day => day >= 1 && day <= 31).sort((a,b) => a - b) : [Number(transaction.date.slice(-2))]; if (frequency === 'BiMonthly' && cleanDueDays.length < 2) return res.status(400).json({ error:'Select two bi-monthly dates.' }); transaction.scheduleId=`s-${Date.now()}`; await database.collection('schedules').insertOne({ id:transaction.scheduleId, ownerId:req.user.id, type:transaction.type, amount:transaction.amount, category:transaction.category, subcategory:transaction.subcategory, startDate:transaction.date, dueDay:cleanDueDays[0], dueDays:cleanDueDays, frequency:frequency || 'Monthly', autoAdd:true, ...(endDate ? { endDate } : {}), ...(transaction.type === 'loan' ? { originalAmount, remainingPrincipal, annualRate, interestType:interestType === 'floating' ? 'floating' : 'fixed' } : {}), ...(transaction.type === 'investment' ? { amountInvestedToDate, currentValue, investmentValuationDate, amountWithdrawn, expectedAnnualRate, projectionEndDate } : {}) }); } await database.collection('transactions').insertOne(transaction); res.status(201).json(transaction); }
  catch (error) { res.status(500).json({ error:error.message }); }
});

app.post('/api/categories', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const { name, kind, spendGroup } = req.body; if (!name?.trim() || !['expense','loan','investment'].includes(kind)) return res.status(400).json({ error:'Category name and type are required.' }); const cleanName = name.trim(); const category = { id:`c-${Date.now()}`, ownerId:req.user.id, name:cleanName, kind, ...(kind === 'expense' ? { spendGroup:cleanSpendGroup(spendGroup, cleanName) } : {}), active:true }; await database.collection('categories').insertOne(category); const { ownerId, _id, ...publicCategory } = category; res.status(201).json(publicCategory); } catch (error) { res.status(500).json({ error:error.message }); } });
app.put('/api/categories/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const existing = await database.collection('categories').findOne({ id:req.params.id, ownerId:req.user.id }); if (!existing) return res.status(404).json({ error:'Category not found' }); const updates = {}; if (req.body.name?.trim()) updates.name=req.body.name.trim(); if (['expense','loan','investment'].includes(req.body.kind)) updates.kind=req.body.kind; const finalKind = updates.kind || existing.kind; const finalName = updates.name || existing.name; if (finalKind === 'expense') updates.spendGroup = cleanSpendGroup(req.body.spendGroup ?? existing.spendGroup, finalName); else updates.spendGroup = null; if (typeof req.body.active === 'boolean') updates.active=req.body.active; const result = await database.collection('categories').findOneAndUpdate({ id:req.params.id, ownerId:req.user.id }, { $set:updates }, { returnDocument:'after', projection:{ _id:0, ownerId:0 } }); res.json(result.value || result); } catch (error) { res.status(500).json({ error:error.message }); } });

app.post('/api/stock-trades', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const symbol = String(req.body.symbol || '').trim().toUpperCase();
    const tradeType = req.body.tradeType === 'sell' ? 'sell' : 'buy';
    const quantity = Number(req.body.quantity);
    const price = Number(req.body.price);
    const fees = Number(req.body.fees || 0);
    const currentPrice = req.body.currentPrice === '' || req.body.currentPrice === null || req.body.currentPrice === undefined ? null : Number(req.body.currentPrice);
    const tradeDate = String(req.body.tradeDate || '');
    if (!symbol || !quantity || quantity <= 0 || !price || price <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return res.status(400).json({ error:'Symbol, quantity, price, and valid trade date are required.' });
    const trade = { id:`st-${Date.now()}`, ownerId:req.user.id, symbol, companyName:String(req.body.companyName || '').trim(), tradeType, quantity, price, fees:Number.isFinite(fees) ? fees : 0, currentPrice:Number.isFinite(currentPrice) ? currentPrice : null, tradeDate, notes:String(req.body.notes || '').trim(), createdAt:new Date() };
    if (tradeType === 'sell') {
      const existingTrades = await database.collection('stockTrades').find({ ownerId:req.user.id, symbol }, { projection:{ _id:0, ownerId:0 } }).toArray();
      const validation = buildStockPositions([...existingTrades, trade]);
      if (validation.error) return res.status(400).json({ error:validation.error });
    }
    await database.collection('stockTrades').insertOne(trade);
    const { ownerId, _id, ...publicTrade } = trade;
    res.status(201).json(publicTrade);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.delete('/api/stock-trades/:id', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    await database.collection('stockTrades').deleteOne({ ownerId:req.user.id, id:req.params.id });
    res.json({ ok:true });
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.post('/api/habits', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const { name, description, icon, color, goalType, target, unit, frequency, startDate, milestoneType, milestoneTarget, growthTarget, growthTargetDate, growthStrategy, growthStep } = req.body;
    if (!name?.trim()) return res.status(400).json({ error:'Habit name is required.' });
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) return res.status(400).json({ error:'Valid start date is required.' });
    const cleanGoalType = ['checkbox','count','duration'].includes(goalType) ? goalType : 'checkbox';
    const habit = {
      id:`h-${Date.now()}`,
      ownerId:req.user.id,
      name:name.trim(),
      description:description?.trim() || '',
      icon:['habit','book','walk','moon','heart','bolt','flame'].includes(icon) ? icon : 'habit',
      color:['purple-bg','amber-bg','teal-bg','blue-bg'].includes(color) ? color : 'purple-bg',
      goalType:cleanGoalType,
      target:cleanGoalType === 'checkbox' ? 1 : Number(target) || 1,
      unit:unit?.trim() || (cleanGoalType === 'duration' ? 'min' : cleanGoalType === 'count' ? 'times' : 'done'),
      frequency:frequency || 'Daily',
      startDate:startDate || localDate(),
      milestoneType:['days','total'].includes(milestoneType) ? milestoneType : 'days',
      milestoneTarget:Number(milestoneTarget) || 30,
      growthTarget:Number(growthTarget) || null,
      growthTargetDate:/^\d{4}-\d{2}-\d{2}$/.test(String(growthTargetDate || '')) ? growthTargetDate : null,
      growthStrategy:['manual','linear','stepped'].includes(growthStrategy) ? growthStrategy : 'manual',
      growthStep:Number(growthStep) || null,
      active:true,
      createdAt:new Date()
    };
    await database.collection('habits').insertOne(habit);
    const { ownerId, _id, ...publicHabit } = habit;
    res.status(201).json(publicHabit);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.put('/api/habits/:id', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const updates = {};
    if (req.body.name?.trim()) updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();
    if (['habit','book','walk','moon','heart','bolt','flame'].includes(req.body.icon)) updates.icon = req.body.icon;
    if (['purple-bg','amber-bg','teal-bg','blue-bg'].includes(req.body.color)) updates.color = req.body.color;
    if (['checkbox','count','duration'].includes(req.body.goalType)) updates.goalType = req.body.goalType;
    if (req.body.target !== undefined) updates.target = Number(req.body.target) || 1;
    if (req.body.unit?.trim()) updates.unit = req.body.unit.trim();
    if (req.body.frequency) updates.frequency = req.body.frequency;
    if (['days','total'].includes(req.body.milestoneType)) updates.milestoneType = req.body.milestoneType;
    if (req.body.milestoneTarget !== undefined) updates.milestoneTarget = Number(req.body.milestoneTarget) || 30;
    if (req.body.growthTarget !== undefined) updates.growthTarget = Number(req.body.growthTarget) || null;
    if (req.body.growthTargetDate !== undefined) {
      if (req.body.growthTargetDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.growthTargetDate))) return res.status(400).json({ error:'Valid growth target date is required.' });
      updates.growthTargetDate = req.body.growthTargetDate || null;
    }
    if (['manual','linear','stepped'].includes(req.body.growthStrategy)) updates.growthStrategy = req.body.growthStrategy;
    if (req.body.growthStep !== undefined) updates.growthStep = Number(req.body.growthStep) || null;
    if (req.body.startDate !== undefined) {
      if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.startDate))) return res.status(400).json({ error:'Valid start date is required.' });
      updates.startDate = req.body.startDate || localDate();
    }
    if (typeof req.body.active === 'boolean') updates.active = req.body.active;
    const result = await database.collection('habits').findOneAndUpdate({ id:req.params.id, ownerId:req.user.id }, { $set:updates }, { returnDocument:'after', projection:{ _id:0, ownerId:0 } });
    res.json(result.value || result);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.delete('/api/habits/:id', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const habit = await database.collection('habits').findOne({ id:req.params.id, ownerId:req.user.id });
    if (!habit) return res.status(404).json({ error:'Habit not found' });
    await database.collection('habits').deleteOne({ id:req.params.id, ownerId:req.user.id });
    await database.collection('habitLogs').deleteMany({ habitId:req.params.id, ownerId:req.user.id });
    res.json({ ok:true });
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.post('/api/habit-logs', requireAuth, async (req, res) => {
  try {
    const database = await ensureDatabase();
    const { habitId, date, value, completed, note, sleepStart, sleepEnd } = req.body;
    if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error:'Habit and date are required.' });
    const habit = await database.collection('habits').findOne({ id:habitId, ownerId:req.user.id });
    if (!habit) return res.status(404).json({ error:'Habit not found.' });
    const sleepValue = sleepStart && sleepEnd ? sleepHours(sleepStart, sleepEnd) : null;
    const numericValue = sleepValue !== null ? sleepValue : value === '' || value === null || value === undefined ? 0 : Number(value) || 0;
    const log = { id:`hl-${habitId}-${date}`, ownerId:req.user.id, habitId, date, value:numericValue, completed:typeof completed === 'boolean' ? completed : numericValue >= Number(habit.target || 1), note:note?.trim() || '', ...(sleepValue !== null ? { sleepStart, sleepEnd } : {}), updatedAt:new Date() };
    await database.collection('habitLogs').updateOne({ ownerId:req.user.id, habitId, date }, { $set:log }, { upsert:true });
    const { ownerId, _id, ...publicLog } = log;
    res.json(publicLog);
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.delete('/api/habit-logs/:habitId/:date', requireAuth, async (req, res) => {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.params.date || ''))) return res.status(400).json({ error:'Valid date is required.' });
    const database = await ensureDatabase();
    await database.collection('habitLogs').deleteOne({ ownerId:req.user.id, habitId:req.params.habitId, date:req.params.date });
    res.json({ ok:true });
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.put('/api/transactions/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const result = await database.collection('transactions').findOneAndUpdate({ id:req.params.id, ownerId:req.user.id }, { $set:req.body }, { returnDocument:'after', projection:{ _id:0, ownerId:0 } }); res.json(result.value || result); } catch (error) { res.status(500).json({ error:error.message }); } });
app.delete('/api/transactions/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const transactions = database.collection('transactions'); const transaction = await transactions.findOne({ id:req.params.id, ownerId:req.user.id }); if (!transaction) return res.status(404).json({ error:'Transaction not found' }); if (transaction.scheduleId) { const periodKey = transaction.periodKey || transaction.date || localDate(); await database.collection('schedules').updateOne({ id:transaction.scheduleId, ownerId:req.user.id }, { $addToSet:{ skippedMonths:periodKey } }); } await transactions.deleteOne({ id:req.params.id, ownerId:req.user.id }); res.json({ ok:true }); } catch (error) { res.status(500).json({ error:error.message }); } });
app.put('/api/schedules/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const updates = { ...req.body }; if (updates.endDate === '') updates.endDate = null; if (updates.investmentValuationDate === '') updates.investmentValuationDate = null; if (updates.projectionEndDate === '') updates.projectionEndDate = null; if (Array.isArray(updates.dueDays)) updates.dueDays = updates.dueDays.map(Number).filter(day => day >= 1 && day <= 31).sort((a,b) => a - b); if (updates.dueDay) updates.dueDay = Number(updates.dueDay); if (updates.dueDays?.length) updates.dueDay = updates.dueDays[0]; if (!['Daily','Weekly','Monthly','BiMonthly','Quarterly','Yearly'].includes(updates.frequency)) delete updates.frequency; if (updates.frequency === 'BiMonthly' && (!updates.dueDays || updates.dueDays.length < 2)) return res.status(400).json({ error:'Select two bi-monthly dates.' }); if (updates.interestType) updates.interestType = updates.interestType === 'floating' ? 'floating' : 'fixed'; for (const field of ['amount','originalAmount','remainingPrincipal','annualRate','amountInvestedToDate','currentValue','amountWithdrawn','expectedAnnualRate','projectionMonths']) if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') updates[field] = Number(updates[field]); const result = await database.collection('schedules').findOneAndUpdate({ id:req.params.id, ownerId:req.user.id }, { $set:updates }, { returnDocument:'after', projection:{ _id:0, ownerId:0 } }); res.json(result.value || result); } catch (error) { res.status(500).json({ error:error.message }); } });
app.get('/api/schedules/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const schedule = await database.collection('schedules').findOne({ id:req.params.id, ownerId:req.user.id }, { projection:{ _id:0, ownerId:0 } }); if (!schedule) return res.status(404).json({ error:'Schedule not found' }); res.json(schedule); } catch (error) { res.status(500).json({ error:error.message }); } });
app.delete('/api/schedules/:id', requireAuth, async (req, res) => { try { const database = await ensureDatabase(); const result = await database.collection('schedules').deleteOne({ id:req.params.id, ownerId:req.user.id }); if (!result.deletedCount) return res.status(404).json({ error:'Schedule not found' }); res.json({ ok:true }); } catch (error) { res.status(500).json({ error:error.message }); } });

app.get(['/dashboard', '/transactions', '/calendar', '/schedule', '/settings', '/outflow', '/investments', '/insights', '/profile', '/habits', '/habit-insights', '/habit-manage', '/habit-checkins'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`Daily Expenses running at http://localhost:${port}`));
