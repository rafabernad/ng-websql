angular.module('angular.websql', [])

/*
.constant('dbConfig', {
    name: "sampleDb",
    version: '1.0',
    description: 'database',
    size: -1
})
*/

.constant('dbTypes', {
    INTEGER: 'INTEGER',
    TEXT: 'TEXT',
    BLOB: 'BLOB',
    REAL: 'REAL',
    NUMERIC: 'NUMERIC'
})

.provider('db', ['dbConfig', function(dbConfig) {

    var $log =  angular.injector(['ng']).get('$log');

    $log.debug("open database ", dbConfig.name, 'ver.', dbConfig.version);
    var db = window.openDatabase(dbConfig.name, dbConfig.version, dbConfig.description, dbConfig.size);
    var resources = {};

    return {
        $get: ['$q', 'dbTypes', function($q, dbTypes) {

            function fetchAll(result) {
                var output = [];

                for (var i = 0; i < result.rows.length; i++) {
                    output.push(result.rows.item(i));
                }

                return output;
            }

            function fetch(result) {
                return result.rows.item(0);
            }

            function resource(props) {

                var deferred = $q.defer();

                if (resources[props.name]) {
                    return $q.reject(Error('Resource already exists'));
                } else {
                    resources[props.name] = deferred.promise;
                }

                var columns = [];

                columns = props.columns.map(function(column) {
                    var colQuery = column.name + ' ' + column.type;

                    if (column.primaryKey) {
                        colQuery += ' PRIMARY KEY';
                    }
                    if (column.autoincrement) {
                        colQuery += ' AUTOINCREMENT';
                    }
                    if (!column.null) {
                        colQuery += ' NOT NULL';
                    }
                    //TODO: insert defaults
                    /*if (column.default !== undefined) {
                        colQuery += ' DEFAULT ';

                        
                    }*/

                    return colQuery;
                });

                var query = 'CREATE TABLE IF NOT EXISTS ' + props.name + ' (' + columns.join(',');

                if (props.foreignKeys) {
                    for (var key in props.foreignKeys) {
                        var foreign = Object.keys(props.foreignKeys[key])[0];
                        query += ', FOREIGN KEY(' + key + ') REFERENCES ' + foreign + '(' + props.foreignKeys[key][foreign] + ')';
                    }
                }

                query += ')';

                this.query(query).then(function() {
                
                    $log.debug('Table \'' + props.name + '\' created');

                    var resourceDefinition = angular.extend({}, props);
                    delete resourceDefinition.name;
                    delete resourceDefinition.columns;
                    delete resourceDefinition.foreignKeys;

                    resources[props.name] = resourceDefinition;

                    props = undefined;

                    angular.extend(deferred.promise, resourceDefinition);
                    deferred.resolve(resourceDefinition);

                }, function() {
                    deferred.reject(Error("Can't create table " + props.name));
                });

                return deferred.promise;

            }

            var factoryDefinition = {
                types: dbTypes,
                query: function(query, bindings) {
                    bindings = typeof bindings !== 'undefined' ? bindings : [];
                    var deferred = $q.defer();

                    db.transaction(function(transaction) {
                        transaction.executeSql(query, bindings, function(transaction, result) {
                            deferred.resolve(result);
                        }, function(transaction, error) {
                            deferred.reject(error);
                        });
                    });

                    return deferred.promise;
                },
                fetch: fetch,
                fetchAll: fetchAll,
                resource: resource
            };

            return factoryDefinition;

        }]
    };
}]);
