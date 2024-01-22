import * as _ from "lodash";

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
  )
);
