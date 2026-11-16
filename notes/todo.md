# Todo

## today
- enforce small iterations
- show abstraction levels of intent
    - start with high level goals
    - break those down into features
    - features break down into lower level features or unit tests

## ideas

- Add a notes / todo feature of the intent UI that let's you track your plan as you go
- project could contain multiple sub-projects - e.g. different deployments
    - each deployment could have it's own set of requirements
 




Problem statements

Agentic software development gives a lot of autonomy to the agent, which creates risk that important requirements could be accidentally removed or broken. Because the agent is writing the test as well as the code, and can change tests as part of a work iteration, we can't rely solely on the tests to prevent regressions being introduced in an unrelated feature. SDD creates a markdown record of intent, but because this is not executable, it can drift, become stale, or just be ignored by the agent. Agents can generate a lot of functionality and code in each iteration, which can make it hard for a human to follow and impossible to fully review all the code. 


### I want to be able to see __how__ my prompt has been translated into a solution

- I'd like to be able to visualise the requirements of my project at varying levels of abstraction.
- I'd like each iteration of agentic development to be atomic, small and easy to visualise in my test report
- I should be able to easily differentiate between functionality that is derivable from my requirements, and functionality that is a design decision by an agent.

### I want to be sure that a new change doesn't introduce a regression in another feature 
- When a change is made to functionality that was previously part of the test contract, then a human MUST explicitly accept that change using the user interface in the report view

### I want an intuitive user interface

- At the very top level of abstraction, I should see the problem statement
- Underneath the problem statement I should see the high level requirements as clickable links
    - these should be:
        - red if any underlying tests have failed
        - bold + italics + prefixed with an asterisk if any underlying tests have changes that need to be accepted
        - green if all underlying tests have passed
    - 
