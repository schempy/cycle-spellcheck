import {run} from '@cycle/core';
import {makeDOMDriver, p, div, span, input, button, select, option} from '@cycle/dom';
import {Observable} from 'rx';

function getSentenceParts(misspelling, sentence) {
  if (misspelling.word) {
    const keywordIndexEnd = sentence.indexOf(misspelling.word) + misspelling.word.length; 
    const before = sentence.slice(0, sentence.indexOf(misspelling.word));
    const after = sentence.slice(keywordIndexEnd);
    const sentenceArray = [
      ...before,
      span('.highlight', misspelling.word),
      ...after
    ];

    return sentenceArray;    
  }

  return [span(sentence)];
}

function getSuggestions(suggestionsList) {
  if (suggestionsList) {
    return suggestionsList.reduce(function(acc, value) {
      acc.push(option({value: value}, value));
      return acc;
    }, []);     
  }

  return [];
}


function intent(DOMSource) {
  // Make API call to get misspellings.

  // Fake the result from the API call.
  const response$ = Observable.of([
      {
        word: 'reallly',
        suggestions: [
          'really',
          'real'
        ]
      },
      {
        word: 'dooo',
        suggestions: [
          'do',
          'poo'
        ]
      }
    ]
  );   

  const changeWordClick$ = DOMSource.select('.change-word').events('click')
    .map((ev, index) => index);

  const ignoreWordClick$ = DOMSource.select('.ignore-word').events('click')
    .map(ev => ev.target);

  const suggestionSelect$ = DOMSource.select('.suggestions').events('change')
    .map(ev => ev.target);

  const changeWordInput$ = DOMSource.select('.word').events('input')
    .debounce(500)
    .map(ev => ev.target);

  const misspellingIndex$ = changeWordClick$
    .startWith(0)
    .merge(ignoreWordClick$)
    .scan((prev, curr) => {
      return prev + 1;
    });

  const resetSuggestionSelect$ = ignoreWordClick$
    .merge(changeWordClick$)
    .withLatestFrom(suggestionSelect$, (click, target) => {
      return target;
    });

  const resetChangeWord$ = changeWordClick$
    .merge(ignoreWordClick$)
    .map(index => ''); 

  const changeWord$ = suggestionSelect$
    .merge(changeWordInput$)
    .map(target => target.value)
    .startWith('');

  const misspellings$ = Observable.combineLatest(
      response$,
      misspellingIndex$,
      (misspellings, index) => {
        if (index === 0) {
          return {
            curr: misspellings[index],
            prev: misspellings[index]
          };

        } else if (index < misspellings.length) {
          return {
            curr: misspellings[index],
            prev: misspellings[index-1]
          };

        } else if (index === misspellings.length) {
          return {
            curr: {},
            prev: misspellings[index-1]
          }

        } else {
          return {
            curr: '',
            prev: ''
          };
        }
      }
  );

  const word$ = changeWordClick$
    .withLatestFrom(changeWord$, misspellings$, (index, changeWord, misspellings) => {
      return {
        oldWord: misspellings.prev.word,
        newWord: changeWord
      };
    });

  const sentence$ = Observable.of('This reallly sucks but so dooo you')
    .merge(word$)
    .scan((prev, curr) => {
      if (curr.newWord.length > 0) {
        return prev.replace(curr.oldWord, curr.newWord);
      } 

      return prev;
    });

  const changeWordValue$ = changeWord$.merge(resetChangeWord$);

  return {
    sentence$,
    misspellings$,
    changeWordValue$,
    resetSuggestionSelect$
  };
}

function model(actions) {
  actions.resetSuggestionSelect$.subscribe(
      target => {
        target.selectedIndex = -1;
      }
  );

  return Observable.combineLatest(
      actions.sentence$,
      actions.misspellings$,
      actions.changeWordValue$,
      (sentence, misspellings, value) => {
        const sentenceParts = getSentenceParts(misspellings.curr, sentence);
        const suggestions = getSuggestions(misspellings.curr.suggestions);

        return {sentenceParts, suggestions, value};
      }
  );
}

function view(state$) {
  return state$.map(state =>
      div([
        div([
          p('Misspellings'),
          div('.misspellings', state.sentenceParts)
        ]),
        div([
          p('Change Word'),
          input('.word', {type: 'text', value: `${state.value}`})
        ]),
        div([
          p('Suggestions'),
          select('.suggestions', {size: 5}, state.suggestions) 
        ]),
        div([
          button('.change-word', 'Change'),
          button('.ignore-word', 'Ignore')
        ])
      ])
    );
}

function main (sources) {
  const actions = intent(sources.DOM);
  const state$ = model(actions);
  const vtree$ = view(state$);

  return {
    DOM: vtree$
  };
}

const drivers = {
  DOM: makeDOMDriver('.spellchecker')
}

run(main, drivers);
