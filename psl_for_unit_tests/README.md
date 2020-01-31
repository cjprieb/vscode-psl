# To Enable Unit Tests
Upload the files here to your Profile directory in order to run unit tests against it from VS Code.

`ZTestRPC.PROC` is the RPC that runs the tests.

`ZAssert.PROC` contains assertion methods that can be used inside a unit test. If the assertion
fails, they will throw an error that will be caught by the `ZTestRPC` to be formatted into a 
failed test response for the PSL extension.

# To Create Unit Tests
Prepend a unit test procedure with `ZTest`. These are the procedures the PSL extension will
look inside for unit tests. eg: `ZTestBalances.PROC`

Prepend a unit test method with `test`. Only those methods inside the unit test procedures found
above will be included. eg: `testClosedLoanBalance`. No parameters are needed for unit tests.