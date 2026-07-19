declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string, options?: any);
    prepare(sql: string): any;
    transaction(fn: (...args: any[]) => any): any;
  }
  namespace Database {
    export type Database = any;
  }
  export default Database;
}
