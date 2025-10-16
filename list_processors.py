from google.cloud import documentai_v1 as documentai

def list_processors(project_id: str, location: str):
    """Lists all processors for a given project and location."""
    client = documentai.DocumentProcessorServiceClient()

    parent = f"projects/{project_id}/locations/{location}"
    try:
        processors = client.list_processors(parent=parent)

        print(f"Processors in {location}:")
        for processor in processors:
            print(f"  - Display Name: {processor.display_name}")
            print(f"    ID: {processor.name.split('/')[-1]}")
    except Exception as e:
        print(f"Error listing processors: {e}")

if __name__ == "__main__":
    project_id = "cendien-sales-support-ai"
    location = "us"
    list_processors(project_id, location)
