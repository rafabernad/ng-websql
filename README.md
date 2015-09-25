# angular-websql
A webSQL wrapper for AngularJS

As easy as creating your factories to define your database structure and your resource methods:

    .factory('samples', ['db', function(db) {
      return db.resource({
        name: "samples",
        columns: [{
            name: 'id',
            type: db.types.INTEGER,
            primaryKey: true,
            autoincrement: false
          }, {
            name: 'name',
            type: db.types.TEXT,
            unique: true
          }, {
            name: 'key',
            type: db.types.INTEGER,
        }],
        foreignKeys: {
            'key': {
              'parentTable': 'id'
            }
        },
        //get all records
        query: function() {
          return db.query('SELECT * FROM samples')
            .then(function(result) {
              return db.fetchAll(result);
            });
        },
        //get a record by id
        get: function(id) {
          return db.query('SELECT * FROM samples WHERE id= ?', [id])
            .then(function(result) {
              return db.fetch(result);
            });
        },
        //and so on
      });
    }])

The only thing you need is the database details:

    .constant('dbConfig', {
        name: "sampleDb",
        version: '1.0',
        description: 'sample database',
        size: -1
    })
