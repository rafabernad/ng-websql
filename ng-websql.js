angular.module('angular.websql', [])

/*
.constant('dbConfig', {
    name: "sampleDb",
    location: dbLocations.DOCUMENTS,
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

.constant('dbLocations', {
    DOCUMENTS: 0, //Documents - visible to iTunes and backed up by iCloud
    LIBRARY: 1, //backed up by iCloud, NOT visible to iTunes
    DEVICE_ONLY: 2 //NOT visible to iTunes and NOT backed up by iCloud
})

.provider('db', ['dbConfig', function(dbConfig) {

    var $log = angular.injector(['ng']).get('$log');

    $log.debug("open database ", dbConfig.name, 'ver.', dbConfig.version);

    var db;


    var resources = {};

    return {
        $get: ['$q', 'dbTypes', 'dbLocations', function($q, dbTypes, dbLocations) {

            var dbPromise = $q.defer();

            if (window.cordova && window.sqlitePlugin) {
                db = sqlitePlugin.openDatabase({
                    name: dbConfig.name,
                    location: dbConfig.location || dbLocations.LIBRARY,
                }, dbPromise.resolve, promise.reject);
            } else {
                try {
                    db = window.openDatabase(dbConfig.name, dbConfig.version, dbConfig.description, dbConfig.size);
                    dbPromise.resolve(db);
                } catch (e) {
                    dbPromise.reject(e);
                }
            }

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
                var columns = [];


                if (resources[props.name]) {
                    return $q.reject(Error('Resource already exists'));
                } else {
                    resources[props.name] = deferred.promise;
                }

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
                    if (column.default !== undefined) {
                        colQuery += ' DEFAULT ';
                        if (angular.isString(column.default)) {
                            colQuery += '\'' + column.default+'\'';
                        } else {
                            colQuery += column.default;
                        }
                    }
                    if (column.check !== undefined) {
                        colQuery += ' CHECK ' + column.name + ' (' + column.check + ')';
                    }

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

                dbPromise.promise.then(angular.bind(this, function() {
                    this.query(query).then(angular.bind(this, function() {
                        if (props.triggers) {
                            var triggers = [],
                                triggerAction,
                                triggerName,
                                triggerBefore,
                                triggerQuery,
                                trigger;

                            for (var action in props.triggers) {
                                triggerAction = action.toUpperCase();
                                triggerName = props.triggers[action].name || (props.name + '-' + action);
                                triggerBefore = props.triggers[action].before || false;
                                triggerQuery = props.trigger[action].query;

                                trigger = 'CREATE TRIGGER IF NOT EXISTS ' + triggerName + ' ' + (triggerBefore ? 'BEFORE' : 'AFTER') +
                                    ' ' + triggerAction + ' ON ' + props.name + 'BEGIN ' + triggerQuery + ' END;';

                                triggers.push(this.query(trigger));

                            }
                            return $q.all(triggers);
                        }
                        return $q.resolve();

                    })).catch(function(error) {
                        deferred.reject(error);
                    }).finally(function() {
                        var resourceDefinition = angular.extend({}, props);
                        delete resourceDefinition.name;
                        delete resourceDefinition.columns;
                        delete resourceDefinition.foreignKeys;

                        resources[props.name] = resourceDefinition;

                        angular.extend(deferred.promise, resourceDefinition);

                        $log.debug('Table \'' + props.name + '\' created/loaded');

                        props = undefined;

                        deferred.resolve(resourceDefinition);
                    });

                }));

                return deferred.promise;

            }

            var factoryDefinition = {
                types: dbTypes,
                query: function(query, bindings) {
                    bindings = typeof bindings !== 'undefined' ? bindings : [];
                    var deferred = $q.defer();

                    dbPromise.promise.then(function() {
                        db.transaction(function(transaction) {
                            transaction.executeSql(query, bindings, function(transaction, result) {
                                deferred.resolve(result);
                            }, function(transaction, error) {
                                deferred.reject(error);
                            });
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
