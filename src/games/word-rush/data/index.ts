import { countries } from "./countries";
import { cities } from "./cities";
import { phrases } from "./phrases";
import { fruits } from "./fruits";
import { sports } from "./sports";
import { actors } from "./actors";
import { quotes } from "./quotes";
import { landmarks } from "./landmarks";
import { animals } from "./animals";
import { brands } from "./brands";
import { occupations } from "./occupations";
import { tvShows } from "./tvshows";
import { movies } from "./movies";
import { kidsMovies } from "./kidsMovies";
import { food } from "./food";
import { drink } from "./drink";
import { kitchen } from "./kitchen";
import { event } from "./event";
import { counties } from "./counties";
import { sportsPlayers } from "./sportsPlayers";

export type Category = {
  name: string;
  words: string[];
};

export const categories: Category[] = [
  { name: "Countries", words: countries },
  { name: "Cities", words: cities },
  { name: "Well Known Phrase", words: phrases },
  { name: "Fruit", words: fruits },
  { name: "Sports", words: sports },
  { name: "Actor/Actress", words: actors },
  { name: "Quote", words: quotes },
  { name: "Landmark", words: landmarks },
  { name: "Animals", words: animals },
  { name: "Brands", words: brands },
  { name: "Occupation", words: occupations },
  { name: "TV Show", words: tvShows },
  { name: "Movie", words: movies },
  { name: "Kids Movie", words: kidsMovies },
  { name: "Food", words: food },
  { name: "Drink", words: drink },
  { name: "In The Kitchen", words: kitchen },
  { name: "Event", words: event },
  { name: "Counties", words: counties },
  { name: "Sports Player", words: sportsPlayers },
];

export function getRandomCategory(): Category {
  return categories[Math.floor(Math.random() * categories.length)];
}

export function getRandomWord(category: Category): string {
  return category.words[Math.floor(Math.random() * category.words.length)];
}
