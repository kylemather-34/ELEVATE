#include "parserClass.hpp"
#include "../../cpp_utils/json.hpp"

using json = nlohmann::json;

int main(int argc, char *argv[])
{
    // Check if a filename was provided
    if (argc != 3)
    {
        cerr << "Usage: " << argv[0] << " <input_file> <output_file>\n";
        return 1;
    }

    string inputFile = argv[1];
    string outputFile = argv[2];

    // Open the text file
    ifstream file(inputFile);
    if (!file.is_open())
    {
        cerr << "Error: Could not open file " << inputFile << "\n";
        return 1;
    }

    vector<BlockEvent> events = Parser::parseFile(file);

    // Base case: if no block events were produced, re-read the file and emit
    // each line as a LINE event so downstream stages always have content to work with.
    bool hasBlocks = false;
    for (const auto &e : events)
        if (e.kind == EventKind::START) { hasBlocks = true; break; }

    if (!hasBlocks)
    {
        events.clear();
        file.clear();
        file.seekg(0);

        string line;
        int lineNumber = 0;
        while (getline(file, line))
        {
            lineNumber++;
            string trimmed = Parser::trim(line);
            trimmed = Parser::stripComment(trimmed);
            if (trimmed.empty()) continue;

            BlockEvent lineEvent;
            lineEvent.kind = EventKind::LINE;
            lineEvent.type = BlockType::UNKNOWN;
            lineEvent.lineNumber = lineNumber;
            lineEvent.indentLevel = Parser::countIndent(line);
            lineEvent.lineText = trimmed;
            events.push_back(lineEvent);
        }
    }

    json output = json::array();

    for (const auto &event : events)
    {
        json obj;

        switch(event.kind)
        {
            case EventKind::START:
                obj["event"] = "START";
                break;
            case EventKind::END:
                obj["event"] = "END";
                break;
            case EventKind::LINE:
                obj["event"] = "LINE";
                break;
        }
        obj["type"] = blockTypeToString(event.type);
        obj["line"] = event.lineNumber;
        obj["indent"] = event.indentLevel;
        obj["text"] = event.lineText;

        output.push_back(obj);
    }

    ofstream outFile(outputFile);

    if (!outFile.is_open())
    {
        cerr << "Error: Could not create output file " << outputFile << "\n";
    }

    outFile << output.dump(4);

    file.close();
    outFile.close();
    return 0;
}