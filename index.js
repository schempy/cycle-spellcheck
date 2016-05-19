import {run} from '@cycle/core';
import {makeDOMDriver, p, div, span, input, button, select, option} from '@cycle/dom';
import {Observable} from 'rx';

function getSentenceParts(misspelling, sentence) {
  if (misspelling.word) {
    let keywordIndexEnd = sentence.indexOf(misspelling.word) + misspelling.word.length; 
    let before = sentence.slice(0, sentence.indexOf(misspelling.word));
    let after = sentence.slice(keywordIndexEnd);
    let sentenceArray = [];

    if (before.length > 0) {
      sentenceArray.push(span(before));
    }

    sentenceArray.push(span('.highlight', misspelling.word));

    if (after.length > 0) {
      sentenceArray.push(span(after));
    }

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
          'realy',
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
    .startWith(0)
    .map((ev, index) => {
      return index;
    });

  const suggestionSelect$ = DOMSource.select('.suggestions').events('change')
    .map((ev) => {
      return ev.target.value;
    })
    .startWith('');
    
  const changeWord$ = suggestionSelect$
    .map((theWord) => {
      return theWord;
    })


  const misspellings$ = Observable.combineLatest(response$, changeWordClick$, (misspellings, index) => {
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
  });

  const word$ = misspellings$
    .map((misspellings) => {
      let newWord = '';

      if (document.querySelector('.word')) {
        newWord = document.querySelector('.word').value;
      }

      return {
        oldWord: misspellings.prev.word,
        newWord: newWord
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

  return {sentence$, misspellings$, changeWord$};
}

function model(actions) {
  return Observable.combineLatest(actions.sentence$, actions.misspellings$, actions.changeWord$, (sentence, misspellings, changeWord) => {
      const sentenceParts = getSentenceParts(misspellings.curr, sentence);
      const suggestions = getSuggestions(misspellings.curr.suggestions);

      return {sentenceParts, suggestions, changeWord};
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
          input('.word', {type: 'text', value: `${state.changeWord}`})
        ]),
        div([
          p('Suggestions'),
          select('.suggestions', {size: 5}, state.suggestions) 
        ]),
        div([
          button('.change-word', 'Change'),
          button('.ignore', 'Ignore')
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
