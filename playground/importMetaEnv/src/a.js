import * as _ from "lodash";
import b from './components/b.js'

console.log(
  _.unionBy(
    [
      {
        id: 1,
      },
      {
        id: 2,
      },
    ],
    "id"
  ),
  b
);

b(false)