const mysql = require('mysql')

const db = mysql.createPool({
  host:'sh-cynosdbmysql-grp-8s97n2us.sql.tencentcdb.com',
  port:'28720',
  user:'root',
  password:'Nmjbs38250b',
  database:'blog_db'
})
// const db = mysql.createPool({
//   host:'localhost',
//   port:'3306',
//   user:'root',
//   password:'admin123',
//   database:'blog_db'
// })

module.exports = db