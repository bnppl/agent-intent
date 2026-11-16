# Examples

Rules:

- A spec can refer to a gherkin scenario or unit test, which should be written using BDD syntax
- A spec can be executable and also have sub specs - e.g.
    - An integration/e2e level spec can run across multiple components
    - Each of those components can have their own specs for the same scenario, but at a lower abstraction level
        - e.g. An E2E spec could describe the user experience of a webapp which has a client and server
        - the client and the server can each have scenarios that describe the lower level interactions for those services
    - A lower level spec can have related unit tests that define interactions the scenario depends on
- The report should be fractal in it's rendering of nested specs.
- The nesting should be consistent with the abstraction level of the spec - i.e. top level specs are all at the top
- The collapsing should follow this format:
- Top level with Problem Statement expands to:
    - list of high level requirements each expanding to:
        - Scenario descriptions list each expanding to:
            - Gherkin steps each expanding to:
                - evidence logs for the running of the test with links to that line of code in vscode
                - a list of sub specs grouped by component expanding to:
                    - Gherkin steps for the scenarios at that abstraction level
                        - and then follow the same approach - expandable to individual logs and sub specs if they're there.
                    - OR If it's a unit test sub spec, it should expand to show the code for that spec along with relevant logs
    - The expansion UX should be:
        - The handle for expansion should be a the high level req / scenario name / unit test name
        - clicking on the > expand icon on the left of the handle expands to the sub specs
        - clicking on a sub spec title should open a new page with that spec as the top level
                  