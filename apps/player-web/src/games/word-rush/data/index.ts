import { animals } from "./animals";
import { colours } from "./colours";
import { food } from "./food";
import { house } from "./house";
import { jobs } from "./jobs";
import { kidsFilms } from "./kidsFilms";
import { nature } from "./nature";
import { places } from "./places";
import { school } from "./school";
import { sports } from "./sports";

export type Category = {
  name: string;
  /** Upper case A–Z, single spaces, and the odd apostrophe or hyphen (shown from the start). */
  phrases: readonly string[];
};

/** Kid-safe categories (ages 6 to 10), UK/Australian spelling. */
export const categories: readonly Category[] = [
  { name: "Animals", phrases: animals },
  { name: "Food", phrases: food },
  { name: "Colours", phrases: colours },
  { name: "School Things", phrases: school },
  { name: "Places", phrases: places },
  { name: "Sports", phrases: sports },
  { name: "Kids' Films", phrases: kidsFilms },
  { name: "Nature", phrases: nature },
  { name: "Jobs", phrases: jobs },
  { name: "Things in a House", phrases: house },
];
